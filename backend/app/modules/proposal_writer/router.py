"""A2 — IA Proposal Writer (Anthropic Claude).

Generates a polished commercial proposal from a project's itinerary + quotation.
Falls back to a templated proposal when ANTHROPIC_API_KEY is not configured
(demo mode).
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.quotations.models import Quotation

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/proposal-writer",
    tags=["proposal-writer"],
    dependencies=[Depends(require_auth)],
)


# ── Schemas ───────────────────────────────────────────────────────────

Tone = Literal["premium", "warm", "concise", "poetic"]
Language = Literal["fr", "en", "es"]


class GenerateRequest(BaseModel):
    project_id: str
    language: Language = "fr"
    tone: Tone = "premium"
    extra_instructions: Optional[str] = Field(default=None, max_length=2000)


class GenerateResponse(BaseModel):
    project_id: str
    language: str
    tone: str
    provider: str  # "anthropic" | "demo"
    content: str
    word_count: int
    duration_ms: int
    cost_estimate_usd: Optional[float] = None
    is_demo: bool = False


class StatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str
    languages: list[str]
    tones: list[str]


# ── Helpers ───────────────────────────────────────────────────────────

MODEL = "claude-3-5-sonnet-20240620"


def _build_context(db: Session, project: Project) -> dict:
    """Aggregate project + itinerary + quotation into a structured dict."""
    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project.id)
    ).scalars().first()

    days: list[dict] = []
    if itin:
        rows = db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.itinerary_id == itin.id)
            .order_by(ItineraryDay.day_number)
        ).scalars().all()
        for d in rows:
            days.append({
                "day": d.day_number,
                "title": d.title,
                "subtitle": d.subtitle,
                "city": d.city,
                "description": d.description,
                "hotel": d.hotel,
                "hotel_category": d.hotel_category,
                "meal_plan": d.meal_plan,
                "activities": d.activities,
            })

    quotation = db.execute(
        select(Quotation).where(Quotation.project_id == project.id)
    ).scalars().first()

    return {
        "project": {
            "name": project.name,
            "client_name": project.client_name,
            "destination": project.destination,
            "duration_days": project.duration_days,
            "duration_nights": project.duration_nights,
            "pax_count": project.pax_count,
            "travel_dates": project.travel_dates,
            "language": project.language,
            "currency": project.currency,
            "highlights": project.highlights or [],
            "inclusions": project.inclusions or [],
            "exclusions": project.exclusions or [],
        },
        "days": days,
        "quotation": {
            "total": float(quotation.total_amount) if quotation and quotation.total_amount else None,
            "currency": (quotation.currency if quotation else None) or project.currency,
        } if quotation else None,
    }


def _system_prompt(language: Language, tone: Tone) -> str:
    lang_label = {"fr": "français", "en": "English", "es": "español"}[language]
    tone_label = {
        "premium": "premium et élégant, hôtellerie 5 étoiles",
        "warm": "chaleureux et accessible",
        "concise": "concis et factuel",
        "poetic": "littéraire et évocateur",
    }[tone]
    return (
        f"Tu es un Travel Designer expert au sein d'une DMC marocaine de luxe. "
        f"Tu rédiges des propositions commerciales en {lang_label} avec un ton {tone_label}. "
        "Structure ta réponse en sections claires : Introduction personnalisée — "
        "Résumé du voyage — Programme jour par jour — Hébergements — "
        "Inclusions / Exclusions — Conditions tarifaires — Conclusion engageante. "
        "Utilise du markdown (titres ##, listes -, gras **). "
        "Évite les superlatifs creux. Cite les villes et hôtels par leur nom. "
        "Reste sobre et professionnel."
    )


def _user_prompt(ctx: dict, extra: Optional[str]) -> str:
    p = ctx["project"]
    lines = [
        f"Voici les informations du dossier client :",
        f"- Nom du circuit : {p['name']}",
        f"- Client : {p['client_name'] or 'À personnaliser'}",
        f"- Destination : {p['destination'] or 'Maroc'}",
        f"- Durée : {p['duration_days'] or '?'} jours / {p['duration_nights'] or '?'} nuits",
        f"- Nombre de voyageurs : {p['pax_count'] or '?'} pax",
        f"- Dates : {p['travel_dates'] or 'À convenir'}",
    ]
    if p["highlights"]:
        lines.append(f"- Temps forts : {', '.join(p['highlights'][:8])}")
    if ctx.get("days"):
        lines.append("\nProgramme :")
        for d in ctx["days"][:14]:
            line = f"  J{d['day']} — {d.get('city') or ''} : {d['title']}"
            if d.get("hotel"):
                line += f" (hôtel : {d['hotel']}, {d.get('hotel_category') or ''})"
            lines.append(line)
    if ctx.get("quotation") and ctx["quotation"].get("total"):
        lines.append(
            f"\nTarif total proposé : {ctx['quotation']['total']:.0f} {ctx['quotation']['currency']} pour {p['pax_count'] or '?'} pax"
        )
    if p["inclusions"]:
        lines.append(f"\nInclusions : {', '.join(p['inclusions'][:10])}")
    if p["exclusions"]:
        lines.append(f"Exclusions : {', '.join(p['exclusions'][:6])}")
    if extra:
        lines.append(f"\nInstructions supplémentaires : {extra}")
    lines.append(
        "\nRédige maintenant la proposition commerciale complète, prête à envoyer au client."
    )
    return "\n".join(lines)


def _demo_proposal(ctx: dict, language: Language, tone: Tone) -> str:
    """Generate a usable templated proposal when no API key is configured."""
    p = ctx["project"]
    intro = {
        "fr": f"Cher{'e' if (p['client_name'] or '').lower().endswith('e') else ''} {p['client_name'] or 'voyageur'},",
        "en": f"Dear {p['client_name'] or 'traveller'},",
        "es": f"Estimado/a {p['client_name'] or 'viajero/a'},",
    }[language]

    pax = p["pax_count"] or 2
    nights = p["duration_nights"] or p["duration_days"] or 7
    total = (ctx.get("quotation") or {}).get("total")
    currency = (ctx.get("quotation") or {}).get("currency") or p["currency"]

    parts = [
        f"# {p['name']}",
        "",
        intro,
        "",
        f"Nous avons le plaisir de vous proposer un voyage sur mesure de **{nights} nuits** "
        f"au {p['destination'] or 'Maroc'} pour **{pax} voyageur(s)**, conçu autour de vos envies.",
        "",
        "## Résumé du voyage",
        f"- Destination : {p['destination'] or 'Maroc'}",
        f"- Durée : {p['duration_days'] or nights+1} jours / {nights} nuits",
        f"- Voyageurs : {pax} personne(s)",
        f"- Dates : {p['travel_dates'] or 'À confirmer'}",
    ]

    if p["highlights"]:
        parts.append("\n## Temps forts")
        for h in p["highlights"][:8]:
            parts.append(f"- {h}")

    if ctx.get("days"):
        parts.append("\n## Programme jour par jour")
        for d in ctx["days"]:
            line = f"\n### Jour {d['day']} — {d.get('city') or ''}\n"
            line += f"**{d['title']}**"
            if d.get("subtitle"):
                line += f" · {d['subtitle']}"
            if d.get("description"):
                line += f"\n\n{d['description']}"
            if d.get("hotel"):
                line += f"\n\n*Hébergement* : **{d['hotel']}**"
                if d.get("hotel_category"):
                    line += f" — {d['hotel_category']}"
            if d.get("meal_plan"):
                line += f"\n*Repas* : {d['meal_plan']}"
            parts.append(line)

    if p["inclusions"]:
        parts.append("\n## Le tarif inclut")
        for inc in p["inclusions"]:
            parts.append(f"- {inc}")
    if p["exclusions"]:
        parts.append("\n## Le tarif n'inclut pas")
        for exc in p["exclusions"]:
            parts.append(f"- {exc}")

    if total:
        parts.append(f"\n## Conditions tarifaires\nPrix global : **{total:,.0f} {currency}** pour {pax} voyageur(s).")
        if pax:
            parts.append(f"Soit environ **{total/pax:,.0f} {currency} / personne** sur la base de {pax} pax.")
        parts.append(
            "\n*Acompte de 30% à la confirmation, solde 30 jours avant le départ. Tarif valable 15 jours.*"
        )

    parts.append(
        "\n## En conclusion\n"
        f"Notre équipe se tient à votre entière disposition pour ajuster ce programme à vos envies. "
        f"Au plaisir de vous accueillir au {p['destination'] or 'Maroc'}.\n\n"
        "*Avec mes plus cordiales salutations,*\n"
        "*L'équipe S'TOURS Voyages*"
    )

    if language != "fr":
        parts.insert(2, f"\n> _(Demo mode — proposition rédigée en français. Configurez `ANTHROPIC_API_KEY` pour la traduction native en {language.upper()}.)_\n")

    if tone != "premium":
        parts.insert(2, f"\n> _(Demo mode — ton {tone} disponible avec Claude.)_\n")

    return "\n".join(parts)


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusResponse)
def get_status() -> StatusResponse:
    return StatusResponse(
        configured=bool(settings.ANTHROPIC_API_KEY),
        provider="anthropic" if settings.ANTHROPIC_API_KEY else "demo",
        model=MODEL,
        languages=["fr", "en", "es"],
        tones=["premium", "warm", "concise", "poetic"],
    )


@router.post("/generate", response_model=GenerateResponse)
def generate_proposal(body: GenerateRequest, db: Session = Depends(get_db)) -> GenerateResponse:
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    ctx = _build_context(db, project)
    start = time.monotonic()

    if not settings.ANTHROPIC_API_KEY:
        content = _demo_proposal(ctx, body.language, body.tone)
        return GenerateResponse(
            project_id=project.id,
            language=body.language,
            tone=body.tone,
            provider="demo",
            content=content,
            word_count=len(content.split()),
            duration_ms=int((time.monotonic() - start) * 1000),
            cost_estimate_usd=0.0,
            is_demo=True,
        )

    # Real Anthropic call
    try:
        import anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=60.0)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=4000,
            temperature=0.7,
            system=_system_prompt(body.language, body.tone),
            messages=[{"role": "user", "content": _user_prompt(ctx, body.extra_instructions)}],
        )
        content = resp.content[0].text  # type: ignore[attr-defined]
        in_tok = resp.usage.input_tokens  # type: ignore[attr-defined]
        out_tok = resp.usage.output_tokens  # type: ignore[attr-defined]
        # claude-3.5-sonnet pricing: $3 / 1M in, $15 / 1M out (approx Apr 2025)
        cost = round(in_tok * 3 / 1_000_000 + out_tok * 15 / 1_000_000, 4)
        return GenerateResponse(
            project_id=project.id,
            language=body.language,
            tone=body.tone,
            provider="anthropic",
            content=content,
            word_count=len(content.split()),
            duration_ms=int((time.monotonic() - start) * 1000),
            cost_estimate_usd=cost,
            is_demo=False,
        )
    except Exception as e:
        logger.exception("Claude proposal generation failed")
        raise HTTPException(502, f"AI provider error: {e}")
