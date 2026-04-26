"""Supplier Performance Score — calculation & persistence.

Score is on 0-100 with 4 components:
  Reviews         40 pts  (avg star rating × 8)
  Incidents       30 pts  (decremented per severity within window)
  Tariff          15 pts  (manual override on Partner.commercial_terms)
  Responsiveness  15 pts  (manual override on Partner.commercial_terms)

Grades: A ≥ 80, B ≥ 65, C ≥ 50, D otherwise.

The service is purely deterministic — no randomness, no external calls.
"""

from datetime import datetime, timedelta, timezone, date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.master_data.models import Partner
from app.modules.reviews.models import Review
from app.modules.supplier_score.models import (
    SupplierIncident, SupplierScoreSnapshot,
)
from app.modules.supplier_score.schemas import (
    ScoreBreakdown, SupplierScoreOut,
)


_INCIDENT_WEIGHTS = {"critical": 10, "high": 5, "medium": 2, "low": 1}
_DEFAULT_TARIFF = 12
_DEFAULT_RESPONSIVENESS = 12
_DEFAULT_PERIOD_DAYS = 180


def _get_overrides(partner: Partner) -> tuple[int, int]:
    """Read manual tariff/responsiveness scores from Partner.address JSON
    (a JSON blob already on the model — used as a generic 'meta' container).
    Looks up the keys ``score_overrides.tariff_compliance`` and
    ``score_overrides.responsiveness``. Falls back to safe defaults.
    """
    addr = getattr(partner, "address", None) or {}
    overrides = (addr.get("score_overrides") if isinstance(addr, dict) else {}) or {}
    try:
        tariff = int(overrides.get("tariff_compliance", _DEFAULT_TARIFF))
    except (TypeError, ValueError):
        tariff = _DEFAULT_TARIFF
    try:
        resp = int(overrides.get("responsiveness", _DEFAULT_RESPONSIVENESS))
    except (TypeError, ValueError):
        resp = _DEFAULT_RESPONSIVENESS
    return max(0, min(15, tariff)), max(0, min(15, resp))


def _grade(total: int) -> str:
    if total >= 80: return "A"
    if total >= 65: return "B"
    if total >= 50: return "C"
    return "D"


def calculate_score(
    db: Session,
    partner: Partner,
    period_days: int = _DEFAULT_PERIOD_DAYS,
) -> SupplierScoreOut:
    """Compute live score for a single partner.

    `partner` must already be loaded (and tenant-checked) by the caller.
    """
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    # ─── Reviews ────────────────────────────────────────────────
    review_q = (
        db.query(func.count(Review.id), func.avg(Review.rating))
        .filter(Review.target_id == partner.id)
        .filter(Review.created_at >= since)
    )
    rcount, ravg = review_q.one()
    rcount = int(rcount or 0)
    ravg = float(ravg or 0)
    if rcount == 0:
        review_score = 30  # neutral starting score for new suppliers
    else:
        review_score = int(round(ravg * 8))    # 5★ = 40
    review_score = max(0, min(40, review_score))

    # ─── Incidents ──────────────────────────────────────────────
    incidents = (
        db.query(SupplierIncident)
        .filter(
            SupplierIncident.partner_id == partner.id,
            SupplierIncident.company_id == partner.company_id,
            SupplierIncident.occurred_at >= since,
        )
        .all()
    )
    penalty = 0
    for inc in incidents:
        penalty += _INCIDENT_WEIGHTS.get((inc.severity or "low").lower(), 1)
    incident_score = max(0, 30 - penalty)

    # ─── Manual overrides ───────────────────────────────────────
    tariff_score, responsiveness_score = _get_overrides(partner)

    total = review_score + incident_score + tariff_score + responsiveness_score
    total = max(0, min(100, total))

    return SupplierScoreOut(
        partner_id=partner.id,
        partner_name=partner.name,
        partner_type=str(partner.type.value if hasattr(partner.type, "value") else partner.type),
        total_score=total,
        grade=_grade(total),
        breakdown=ScoreBreakdown(
            review_score=review_score,
            incident_score=incident_score,
            tariff_score=tariff_score,
            responsiveness_score=responsiveness_score,
            review_count=rcount,
            review_avg=round(ravg, 2),
            incident_count=len(incidents),
        ),
        period_days=period_days,
        computed_at=datetime.now(timezone.utc),
    )


def snapshot_today(
    db: Session,
    partner: Partner,
    score: Optional[SupplierScoreOut] = None,
) -> SupplierScoreSnapshot:
    """Persist today's snapshot (overwrites if one already exists for today)."""
    score = score or calculate_score(db, partner)
    today = date.today()
    existing = (
        db.query(SupplierScoreSnapshot)
        .filter(
            SupplierScoreSnapshot.partner_id == partner.id,
            SupplierScoreSnapshot.snapshot_date == today,
            SupplierScoreSnapshot.company_id == partner.company_id,
        )
        .first()
    )
    if existing:
        snap = existing
    else:
        snap = SupplierScoreSnapshot(
            company_id=partner.company_id,
            partner_id=partner.id,
            snapshot_date=today,
        )
    snap.total_score = score.total_score
    snap.review_score = score.breakdown.review_score
    snap.incident_score = score.breakdown.incident_score
    snap.tariff_score = score.breakdown.tariff_score
    snap.responsiveness_score = score.breakdown.responsiveness_score
    snap.review_count = score.breakdown.review_count
    snap.review_avg = score.breakdown.review_avg
    snap.incident_count = score.breakdown.incident_count
    db.add(snap); db.commit(); db.refresh(snap)
    return snap


def list_supplier_scores(
    db: Session,
    company_id: str,
    only_suppliers: bool = True,
    period_days: int = _DEFAULT_PERIOD_DAYS,
) -> list[SupplierScoreOut]:
    """Live scores for every partner of a tenant. Sorted high → low."""
    q = db.query(Partner).filter(Partner.company_id == company_id)
    if only_suppliers:
        q = q.filter(Partner.type.in_(["supplier", "guide"]))
    out = [calculate_score(db, p, period_days) for p in q.all()]
    out.sort(key=lambda s: s.total_score, reverse=True)
    return out
