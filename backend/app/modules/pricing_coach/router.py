"""A3 — Pricing Coach.

Analyses past quotations + project outcomes (won / lost / pending) to recommend
an optimal margin % for a new project given destination, season, duration and pax.

Demo mode (no `ANTHROPIC_API_KEY`) returns a fully deterministic statistical
recommendation. When Claude is configured, it generates an additional narrative
with strategic context (competitive positioning, season effects, risk-flags).
"""

from __future__ import annotations

import logging
import statistics
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.projects.models import Project, ProjectStatus
from app.modules.quotations.models import Quotation, QuotationStatus

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pricing-coach",
    tags=["pricing-coach"],
    dependencies=[Depends(require_auth)],
)


# ── Constants ────────────────────────────────────────────────────────

# MENA market reference margins (high luxury - inbound DMC sector — anonymised peers)
PEER_MARGIN_BAND = (15.0, 28.0)
PEER_AVG = 20.5

# Seasonality multiplier (vs baseline 1.00) — peak demand allows higher margin
SEASONS = {
    "high":   {"label": "Haute saison", "months": [3, 4, 5, 9, 10, 11], "multiplier": 1.10},
    "shoulder": {"label": "Mi-saison",  "months": [2, 6, 12], "multiplier": 1.00},
    "low":    {"label": "Basse saison", "months": [1, 7, 8],  "multiplier": 0.92},
}

# Duration buckets
DURATION_BUCKETS = [
    (1, 4,  "court (≤4j)"),
    (5, 7,  "moyen (5-7j)"),
    (8, 12, "long (8-12j)"),
    (13, 99, "extra-long (13j+)"),
]


# ── Schemas ──────────────────────────────────────────────────────────

class PriceSample(BaseModel):
    project_id: str
    project_name: Optional[str]
    destination: Optional[str]
    duration_days: Optional[int]
    pax_count: Optional[int]
    margin_pct: float
    total_cost: Optional[float]
    total_selling: Optional[float]
    status: str
    outcome: str  # won | lost | pending


class CoachRecommendation(BaseModel):
    requested_destination: Optional[str]
    requested_duration: Optional[int]
    requested_pax: Optional[int]
    requested_season: Optional[str]
    sample_size: int
    won_count: int
    lost_count: int
    win_rate: float
    margin_won_avg: Optional[float]
    margin_lost_avg: Optional[float]
    margin_p25: Optional[float]
    margin_p50: Optional[float]
    margin_p75: Optional[float]
    margin_recommended: float
    margin_min_safe: float
    margin_max_aggressive: float
    season: Optional[str]
    season_multiplier: float
    duration_bucket: Optional[str]
    flags: list[str]
    rationale: str
    samples_used: list[PriceSample]
    is_demo: bool
    provider: str  # demo | anthropic


class StatusOut(BaseModel):
    configured: bool
    provider: str
    is_demo: bool
    peer_band: tuple[float, float]
    peer_avg: float


# ── Helpers ──────────────────────────────────────────────────────────

def _outcome(p: Project) -> str:
    s = (p.status or "").lower()
    if s in ("won", "validated", "in_progress"):
        return "won"
    if s in ("lost", "cancelled", "rejected"):
        return "lost"
    return "pending"


def _season_for(month: int) -> tuple[str, dict]:
    for key, meta in SEASONS.items():
        if month in meta["months"]:
            return key, meta
    return "shoulder", SEASONS["shoulder"]


def _duration_bucket(d: Optional[int]) -> Optional[str]:
    if not d:
        return None
    for lo, hi, label in DURATION_BUCKETS:
        if lo <= d <= hi:
            return label
    return None


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _samples(db: Session) -> list[PriceSample]:
    """Pull all (project, latest quotation) pairs that have a margin."""
    out: list[PriceSample] = []
    projects = db.execute(select(Project)).scalars().all()
    for p in projects:
        q = (
            db.execute(
                select(Quotation)
                .where(Quotation.project_id == p.id)
                .order_by(Quotation.version.desc())
            )
            .scalars()
            .first()
        )
        if not q:
            continue
        margin = float(q.margin_pct or 0)
        if margin <= 0:
            continue
        out.append(PriceSample(
            project_id=p.id,
            project_name=p.name,
            destination=p.destination,
            duration_days=p.duration_days,
            pax_count=p.pax_count,
            margin_pct=margin,
            total_cost=float(q.total_cost) if q.total_cost else None,
            total_selling=float(q.total_selling) if q.total_selling else None,
            status=p.status if isinstance(p.status, str) else str(p.status),
            outcome=_outcome(p),
        ))
    return out


def _filter(samples: list[PriceSample], destination: Optional[str], duration: Optional[int]) -> list[PriceSample]:
    out = samples
    if destination:
        nd = _norm(destination)
        # Match if any token of dest is in sample.destination
        tokens = [t.strip() for t in nd.split(",") if t.strip()]
        out = [
            s for s in out
            if s.destination and any(tok in _norm(s.destination) for tok in tokens)
        ]
    if duration:
        bucket = _duration_bucket(duration)
        out = [s for s in out if _duration_bucket(s.duration_days) == bucket]
    return out


def _percentile(values: list[float], p: float) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def _build_rationale(rec: dict[str, Any]) -> str:
    parts = []
    if rec["sample_size"] == 0:
        parts.append(
            f"Aucun historique exploitable pour ces paramètres. "
            f"Recommandation par défaut sur la moyenne marché ({PEER_AVG}%) pondérée par la saisonnalité."
        )
    else:
        parts.append(
            f"Analyse de **{rec['sample_size']} cotation(s)** "
            f"({rec['won_count']} gagnée(s) · {rec['lost_count']} perdue(s) · taux de conversion **{rec['win_rate']:.0f}%**)."
        )
        if rec["margin_won_avg"] is not None:
            parts.append(
                f"Marges gagnées : moyenne **{rec['margin_won_avg']:.1f}%**, "
                f"médiane {rec['margin_p50']:.1f}% (p25 {rec['margin_p25']:.1f}% — p75 {rec['margin_p75']:.1f}%)."
            )
        if rec["margin_lost_avg"] is not None and rec["margin_won_avg"] is not None:
            delta = rec["margin_lost_avg"] - rec["margin_won_avg"]
            if delta > 1.5:
                parts.append(
                    f"Les devis perdus avaient en moyenne **+{delta:.1f}pts de marge** — signal de sensibilité prix."
                )
    if rec["season"]:
        parts.append(
            f"Période demandée : {SEASONS[rec['season']]['label']} (coefficient saisonnier ×{rec['season_multiplier']:.2f})."
        )
    parts.append(
        f"**Recommandation : marge cible {rec['margin_recommended']:.1f}%** "
        f"(plancher prudent {rec['margin_min_safe']:.1f}% — plafond agressif {rec['margin_max_aggressive']:.1f}%)."
    )
    return "\n\n".join(parts)


def _claude_narrative(rec: dict[str, Any], samples: list[PriceSample]) -> Optional[str]:
    if not getattr(settings, "ANTHROPIC_API_KEY", None):
        return None
    try:
        import anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)
        prompt = (
            "Tu es un Pricing Coach pour DMC marocain. "
            "Voici les statistiques agrégées d'un dataset de cotations passées et une recommandation calculée. "
            "Rédige UNE narration en français de 4-6 phrases pour un Travel Designer : "
            "explique la logique, mets en évidence un risque ou une opportunité concrète, "
            "et propose une action commerciale (négociation fournisseur, upsell, réduire la marge sur une seule ligne, etc.).\n\n"
            f"Données : {rec}\n"
            f"Échantillons : {[s.dict() for s in samples[:6]]}"
        )
        resp = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if hasattr(b, "text"))
    except Exception as e:  # pragma: no cover
        logger.warning("Claude narrative failed: %s", e)
        return None


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusOut)
def status() -> StatusOut:
    has_key = bool(getattr(settings, "ANTHROPIC_API_KEY", None))
    return StatusOut(
        configured=has_key,
        provider="anthropic" if has_key else "demo",
        is_demo=not has_key,
        peer_band=PEER_MARGIN_BAND,
        peer_avg=PEER_AVG,
    )


@router.get("/dataset", response_model=list[PriceSample])
def dataset(db: Session = Depends(get_db)) -> list[PriceSample]:
    return _samples(db)


@router.get("/recommend", response_model=CoachRecommendation)
def recommend(
    destination: Optional[str] = None,
    duration_days: Optional[int] = None,
    pax: Optional[int] = None,
    departure_month: Optional[int] = None,
    db: Session = Depends(get_db),
) -> CoachRecommendation:
    """Compute optimal margin % for a new quote.

    All filters are optional. When fewer than 3 matching samples are found,
    we fall back to the global dataset and lower the confidence.
    """
    all_samples = _samples(db)
    filtered = _filter(all_samples, destination, duration_days)
    flags: list[str] = []

    if len(filtered) < 3:
        if len(filtered) > 0:
            flags.append(
                f"Échantillon insuffisant ({len(filtered)}). Calcul élargi à l'ensemble du dataset ({len(all_samples)})."
            )
        filtered = all_samples

    if not filtered:
        # Cold start fallback
        flags.append("Cold-start : aucun historique. Recommandation = moyenne marché ajustée saison.")
        season_key, season_meta = (
            _season_for(departure_month) if departure_month else ("shoulder", SEASONS["shoulder"])
        )
        recommended = round(PEER_AVG * season_meta["multiplier"], 1)
        rec_dict: dict[str, Any] = {
            "sample_size": 0,
            "won_count": 0,
            "lost_count": 0,
            "win_rate": 0.0,
            "margin_won_avg": None,
            "margin_lost_avg": None,
            "margin_p25": None,
            "margin_p50": None,
            "margin_p75": None,
            "margin_recommended": recommended,
            "margin_min_safe": round(PEER_MARGIN_BAND[0] * season_meta["multiplier"], 1),
            "margin_max_aggressive": round(PEER_MARGIN_BAND[1] * season_meta["multiplier"], 1),
            "season": season_key,
            "season_multiplier": season_meta["multiplier"],
        }
        rationale = _build_rationale(rec_dict)
        return CoachRecommendation(
            requested_destination=destination,
            requested_duration=duration_days,
            requested_pax=pax,
            requested_season=season_meta["label"] if departure_month else None,
            duration_bucket=_duration_bucket(duration_days),
            samples_used=[],
            flags=flags,
            rationale=rationale,
            is_demo=not bool(getattr(settings, "ANTHROPIC_API_KEY", None)),
            provider="demo",
            **rec_dict,
        )

    won = [s for s in filtered if s.outcome == "won"]
    lost = [s for s in filtered if s.outcome == "lost"]
    pending = [s for s in filtered if s.outcome == "pending"]
    win_pool = won + pending  # pending counts as in-flight
    decided = won + lost
    win_rate = (len(won) / len(decided) * 100.0) if decided else 0.0

    won_margins = [s.margin_pct for s in win_pool] or [s.margin_pct for s in filtered]
    lost_margins = [s.margin_pct for s in lost]

    p25 = _percentile(won_margins, 0.25) or 0.0
    p50 = _percentile(won_margins, 0.50) or 0.0
    p75 = _percentile(won_margins, 0.75) or 0.0

    won_avg = statistics.mean(won_margins) if won_margins else None
    lost_avg = statistics.mean(lost_margins) if lost_margins else None

    season_key, season_meta = (
        _season_for(departure_month) if departure_month else ("shoulder", SEASONS["shoulder"])
    )

    base_rec = won_avg if won_avg is not None else PEER_AVG
    recommended = round(base_rec * season_meta["multiplier"], 1)
    margin_min = round(p25 * season_meta["multiplier"], 1) if p25 else round(PEER_MARGIN_BAND[0] * season_meta["multiplier"], 1)
    margin_max = round(p75 * season_meta["multiplier"], 1) if p75 else round(PEER_MARGIN_BAND[1] * season_meta["multiplier"], 1)
    if margin_max < recommended:
        margin_max = recommended + 2.0

    if recommended < PEER_MARGIN_BAND[0]:
        flags.append(f"Marge recommandée ({recommended}%) sous la fourchette marché ({PEER_MARGIN_BAND[0]}-{PEER_MARGIN_BAND[1]}%) — vérifier coûts.")
    if recommended > PEER_MARGIN_BAND[1]:
        flags.append(f"Marge recommandée ({recommended}%) au-dessus de la fourchette marché — risque de perte client.")
    if lost_avg and won_avg and lost_avg - won_avg > 3:
        flags.append(f"Marges perdues nettement plus élevées (Δ +{lost_avg - won_avg:.1f}pts) — sensibilité prix forte.")
    if duration_days and duration_days >= 10 and recommended < 18:
        flags.append("Circuits longs : opportunité d'upsell premium (spa, vols intérieurs) sans baisser la marge.")

    rec_dict = {
        "sample_size": len(filtered),
        "won_count": len(won),
        "lost_count": len(lost),
        "win_rate": round(win_rate, 1),
        "margin_won_avg": round(won_avg, 1) if won_avg else None,
        "margin_lost_avg": round(lost_avg, 1) if lost_avg else None,
        "margin_p25": round(p25, 1) if p25 else None,
        "margin_p50": round(p50, 1) if p50 else None,
        "margin_p75": round(p75, 1) if p75 else None,
        "margin_recommended": recommended,
        "margin_min_safe": margin_min,
        "margin_max_aggressive": margin_max,
        "season": season_key,
        "season_multiplier": season_meta["multiplier"],
    }
    rationale = _build_rationale(rec_dict)
    narrative = _claude_narrative(rec_dict, filtered)
    if narrative:
        rationale = rationale + "\n\n— **Analyse Claude** —\n" + narrative

    has_key = bool(getattr(settings, "ANTHROPIC_API_KEY", None))
    return CoachRecommendation(
        requested_destination=destination,
        requested_duration=duration_days,
        requested_pax=pax,
        requested_season=season_meta["label"] if departure_month else None,
        duration_bucket=_duration_bucket(duration_days),
        samples_used=filtered[:20],
        flags=flags,
        rationale=rationale,
        is_demo=not has_key,
        provider="anthropic" if (has_key and narrative) else "demo",
        **rec_dict,
    )


@router.get("/insights")
def insights(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Aggregate dashboard: per-destination, per-duration, per-status."""
    samples = _samples(db)
    by_dest: dict[str, list[float]] = defaultdict(list)
    by_duration: dict[str, list[float]] = defaultdict(list)
    by_outcome: dict[str, list[float]] = defaultdict(list)

    for s in samples:
        if s.destination:
            primary = s.destination.split(",")[0].strip()
            by_dest[primary].append(s.margin_pct)
        bucket = _duration_bucket(s.duration_days)
        if bucket:
            by_duration[bucket].append(s.margin_pct)
        by_outcome[s.outcome].append(s.margin_pct)

    def _summary(arr: list[float]) -> dict[str, Any]:
        if not arr:
            return {"count": 0, "avg": None, "min": None, "max": None}
        return {
            "count": len(arr),
            "avg": round(statistics.mean(arr), 1),
            "min": round(min(arr), 1),
            "max": round(max(arr), 1),
        }

    return {
        "total_samples": len(samples),
        "by_destination": [{"key": k, **_summary(v)} for k, v in sorted(by_dest.items(), key=lambda x: -len(x[1]))],
        "by_duration": [{"key": k, **_summary(v)} for k, v in by_duration.items()],
        "by_outcome": {k: _summary(v) for k, v in by_outcome.items()},
        "peer_avg": PEER_AVG,
        "peer_band": list(PEER_MARGIN_BAND),
    }
