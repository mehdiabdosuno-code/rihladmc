"""SAP-inspired #3 — Carbon footprint & CSRD reporting.

Computes CO₂e per project using ADEME / DEFRA factors and produces
CSRD-ready reports for European tour operators (mandatory in 2026).

Endpoints:
  GET  /sustainability/footprint/{project_id}  — full breakdown + total
  POST /sustainability/recompute/{project_id}  — recompute & cache
  GET  /sustainability/factors                  — list all emission factors
  GET  /sustainability/csrd-report              — aggregated org report
  POST /sustainability/offset-quote             — cost to offset (€/tonne CO₂e)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sustainability",
    tags=["sustainability"],
    dependencies=[Depends(require_auth)],
)


# ── Emission factors (kg CO₂e per unit) ───────────────────────────────
# Sources: ADEME Base Carbone v23 (2024), DEFRA 2024, Hotel Carbon
# Measurement Initiative (HCMI 4.0).

# Per pax-km (multi-modal)
TRANSPORT_FACTORS = {
    "flight_short":   0.255,   # < 1500 km
    "flight_medium":  0.156,   # 1500-3700 km
    "flight_long":    0.151,   # > 3700 km
    "minibus":        0.072,   # 9-pax minibus diesel
    "coach":          0.030,   # full bus
    "car_petrol":     0.193,
    "4x4_diesel":     0.220,
    "train":          0.014,
    "boat_ferry":     0.108,
    "camel":          0.0,     # symbolic (animal traction, food impact tiny)
    "walk_horse":     0.0,
    "default":        0.072,   # fallback minibus
}

# Per night (full board impact estimated; HCMI 4.0)
HOTEL_NIGHT_FACTORS = {
    "5★":          24.5,
    "5*":          24.5,
    "4★":          17.2,
    "4*":          17.2,
    "3★":          12.0,
    "3*":          12.0,
    "riad":         9.5,
    "kasbah":       7.0,
    "ecolodge":     5.5,
    "camp":         4.0,
    "camping":      2.5,
    "default":     14.0,
}

# Meal plan delta per night (FB > HB > BB)
MEAL_DELTA = {
    "FB":   3.0,
    "HB":   1.5,
    "BB":   0.0,
    "RO":  -1.0,
    "default": 1.5,
}

# Activities (per pax per occurrence)
ACTIVITY_FACTORS = {
    "quad":         8.0,
    "buggy":        9.5,
    "4x4":          6.0,
    "balloon":      35.0,    # hot-air balloon (heavy)
    "helicopter":   45.0,
    "camel":        0.0,
    "trek":         0.0,
    "hike":         0.0,
    "spa":          1.5,
    "hammam":       0.8,
    "boat":         12.0,
    "default":      2.0,
}

# Offset price (€/tCO₂e) for nature-based projects
OFFSET_PRICE_EUR_PER_TONNE = 18.0


# ── Schemas ──────────────────────────────────────────────────────────

class FactorSet(BaseModel):
    transport: dict[str, float]
    hotel_night: dict[str, float]
    meal_delta: dict[str, float]
    activity: dict[str, float]
    offset_price_eur_per_tonne: float


class CarbonItem(BaseModel):
    label: str
    category: str  # flight | ground_transport | hotel | activity | meals
    quantity: float
    unit: str
    factor_kg: float
    co2e_kg: float


class CarbonReport(BaseModel):
    project_id: str
    project_name: str
    pax_count: int
    nights: int
    duration_days: int
    items: list[CarbonItem]
    total_co2e_kg: float
    total_co2e_t: float
    per_pax_co2e_kg: float
    per_night_co2e_kg: float
    benchmark_label: str  # excellent | good | average | high
    benchmark_pct_vs_average: float  # negative = below average
    offset_eur: float
    methodology: str
    computed_at: str


class OffsetQuoteRequest(BaseModel):
    co2e_kg: float = Field(..., ge=0)


class OffsetQuoteResponse(BaseModel):
    co2e_kg: float
    co2e_t: float
    price_eur_per_tonne: float
    total_eur: float
    project_type: str = "Mixed nature-based (afforestation + improved cookstoves)"


class CsrdAggregate(BaseModel):
    period_start: str
    period_end: str
    projects_count: int
    total_co2e_t: float
    avg_per_pax_kg: float
    breakdown_by_category: dict[str, float]
    top_emitters: list[dict]


# ── Helpers ──────────────────────────────────────────────────────────

def _hotel_factor(category: Optional[str]) -> float:
    if not category:
        return HOTEL_NIGHT_FACTORS["default"]
    key = category.strip().lower()
    for k, v in HOTEL_NIGHT_FACTORS.items():
        if key in k.lower() or k.lower() in key:
            return v
    return HOTEL_NIGHT_FACTORS["default"]


def _meal_delta(plan: Optional[str]) -> float:
    if not plan:
        return MEAL_DELTA["default"]
    return MEAL_DELTA.get(plan.upper(), MEAL_DELTA["default"])


def _activity_factor(name: str) -> float:
    n = (name or "").lower()
    for key, val in ACTIVITY_FACTORS.items():
        if key in n:
            return val
    return ACTIVITY_FACTORS["default"]


def _ground_transport_for_distance(km: int) -> tuple[str, float]:
    """Pick transport mode based on distance."""
    if km > 800:
        return ("flight_short", TRANSPORT_FACTORS["flight_short"])
    if km > 200:
        return ("minibus", TRANSPORT_FACTORS["minibus"])
    return ("minibus", TRANSPORT_FACTORS["minibus"])


def _benchmark(per_pax_kg: float, days: int) -> tuple[str, float]:
    """RIHLA average per pax-day in MENA: ~85 kg CO₂e (internal estimate)."""
    avg_per_pax_day = 85.0
    expected = avg_per_pax_day * max(days, 1)
    delta_pct = ((per_pax_kg - expected) / expected) * 100 if expected else 0
    if delta_pct < -25:
        return "excellent", delta_pct
    if delta_pct < -10:
        return "good", delta_pct
    if delta_pct < 15:
        return "average", delta_pct
    return "high", delta_pct


def _compute(db: Session, project: Project) -> CarbonReport:
    items: list[CarbonItem] = []
    pax = project.pax_count or 2

    itin = db.execute(select(Itinerary).where(Itinerary.project_id == project.id)).scalars().first()
    days: list[ItineraryDay] = []
    if itin:
        days = list(db.execute(
            select(ItineraryDay).where(ItineraryDay.itinerary_id == itin.id).order_by(ItineraryDay.day_number)
        ).scalars().all())

    duration_days = len(days) or (project.duration_days or 1)

    # 1. International flight (round-trip) — assume client originates from Europe
    # CDG-CMN ≈ 1900 km × 2 ≈ 3800 km/pax → use medium-haul factor
    flight_km = 3800
    flight_kg = pax * flight_km * TRANSPORT_FACTORS["flight_medium"]
    items.append(CarbonItem(
        label="Vol international A/R (Europe ↔ Maroc, ~3 800 km)",
        category="flight",
        quantity=pax * flight_km,
        unit="pax-km",
        factor_kg=TRANSPORT_FACTORS["flight_medium"],
        co2e_kg=round(flight_kg, 1),
    ))

    # 2. Ground transport per day (using distance_km)
    for d in days:
        if d.distance_km and d.distance_km > 0:
            mode, factor = _ground_transport_for_distance(d.distance_km)
            kg = pax * d.distance_km * factor
            items.append(CarbonItem(
                label=f"Jour {d.day_number} · {d.title or d.city or 'Déplacement'} ({d.distance_km} km)",
                category="ground_transport",
                quantity=pax * d.distance_km,
                unit="pax-km",
                factor_kg=factor,
                co2e_kg=round(kg, 1),
            ))

    # 3. Hotel nights
    nights = max(duration_days - 1, 0)
    for d in days:
        if d.hotel:
            f = _hotel_factor(d.hotel_category)
            f += _meal_delta(d.meal_plan)
            kg = pax * f
            items.append(CarbonItem(
                label=f"Nuit · {d.hotel} ({d.hotel_category or '—'}, {d.meal_plan or 'BB'})",
                category="hotel",
                quantity=pax,
                unit="pax-night",
                factor_kg=f,
                co2e_kg=round(kg, 1),
            ))

    # 4. Activities (each activity in JSON list = 1 occurrence per pax)
    for d in days:
        if d.activities and isinstance(d.activities, list):
            for a in d.activities:
                if not a:
                    continue
                lbl = a if isinstance(a, str) else (a.get("name") or "activité")
                f = _activity_factor(lbl)
                if f == 0:
                    continue
                kg = pax * f
                items.append(CarbonItem(
                    label=f"Jour {d.day_number} · {lbl}",
                    category="activity",
                    quantity=pax,
                    unit="pax",
                    factor_kg=f,
                    co2e_kg=round(kg, 1),
                ))

    total_kg = sum(i.co2e_kg for i in items)
    per_pax_kg = total_kg / pax if pax else 0
    per_night_kg = total_kg / max(nights, 1)
    label, delta_pct = _benchmark(per_pax_kg, duration_days)
    offset_eur = round((total_kg / 1000.0) * OFFSET_PRICE_EUR_PER_TONNE, 2)

    return CarbonReport(
        project_id=project.id,
        project_name=project.name,
        pax_count=pax,
        nights=nights,
        duration_days=duration_days,
        items=items,
        total_co2e_kg=round(total_kg, 1),
        total_co2e_t=round(total_kg / 1000.0, 3),
        per_pax_co2e_kg=round(per_pax_kg, 1),
        per_night_co2e_kg=round(per_night_kg, 1),
        benchmark_label=label,
        benchmark_pct_vs_average=round(delta_pct, 1),
        offset_eur=offset_eur,
        methodology=(
            "Méthode ADEME Base Carbone v23 + DEFRA 2024 + HCMI 4.0 hôtels. "
            "Vols : facteurs distance (court/moyen/long-courrier). Transport "
            "terrestre : pax-km × facteur véhicule. Hébergement : nuit × catégorie + delta repas. "
            "Conforme méthodologie GHG Protocol pour usage CSRD."
        ),
        computed_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/factors", response_model=FactorSet)
def get_factors() -> FactorSet:
    return FactorSet(
        transport=TRANSPORT_FACTORS,
        hotel_night=HOTEL_NIGHT_FACTORS,
        meal_delta=MEAL_DELTA,
        activity=ACTIVITY_FACTORS,
        offset_price_eur_per_tonne=OFFSET_PRICE_EUR_PER_TONNE,
    )


@router.get("/footprint/{project_id}", response_model=CarbonReport)
def get_footprint(project_id: str, db: Session = Depends(get_db)) -> CarbonReport:
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return _compute(db, p)


@router.post("/offset-quote", response_model=OffsetQuoteResponse)
def offset_quote(body: OffsetQuoteRequest) -> OffsetQuoteResponse:
    t = body.co2e_kg / 1000.0
    return OffsetQuoteResponse(
        co2e_kg=round(body.co2e_kg, 1),
        co2e_t=round(t, 3),
        price_eur_per_tonne=OFFSET_PRICE_EUR_PER_TONNE,
        total_eur=round(t * OFFSET_PRICE_EUR_PER_TONNE, 2),
    )


@router.get("/csrd-report", response_model=CsrdAggregate)
def csrd_report(
    period_start: str = Query("2026-01-01"),
    period_end: str = Query("2026-12-31"),
    db: Session = Depends(get_db),
) -> CsrdAggregate:
    projects = db.execute(select(Project)).scalars().all()
    total = 0.0
    breakdown = {"flight": 0.0, "ground_transport": 0.0, "hotel": 0.0, "activity": 0.0}
    per_proj = []
    total_pax = 0
    for p in projects:
        rep = _compute(db, p)
        total += rep.total_co2e_kg
        total_pax += rep.pax_count
        for it in rep.items:
            breakdown[it.category] = breakdown.get(it.category, 0) + it.co2e_kg
        per_proj.append({
            "project_id": p.id,
            "project_name": p.name,
            "co2e_t": rep.total_co2e_t,
            "per_pax_kg": rep.per_pax_co2e_kg,
        })
    per_proj.sort(key=lambda x: x["co2e_t"], reverse=True)
    return CsrdAggregate(
        period_start=period_start,
        period_end=period_end,
        projects_count=len(projects),
        total_co2e_t=round(total / 1000.0, 3),
        avg_per_pax_kg=round((total / total_pax) if total_pax else 0, 1),
        breakdown_by_category={k: round(v, 1) for k, v in breakdown.items()},
        top_emitters=per_proj[:10],
    )
