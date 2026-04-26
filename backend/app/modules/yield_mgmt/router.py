"""Yield Management — Dynamic pricing & seasonal optimization.

Analyzes booking patterns and seasonality to:
  - Recommend optimal margins per season
  - Detect high/low demand periods
  - Suggest promotions for low-fill periods
  - Auto-adjust pricing based on lead time

Endpoints:
  GET  /yield/season-calendar      — Seasonal pricing calendar for Morocco
  POST /yield/optimize-margin      — Get recommended margin for given dates
  POST /yield/price-adjustment     — Apply seasonal/demand adjustments to pricing
  GET  /yield/demand-forecast      — Demand forecast based on historical patterns
"""

from datetime import datetime, date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.shared.dependencies import require_auth

router = APIRouter(
    prefix="/yield",
    tags=["yield-management"],
    dependencies=[Depends(require_auth)],
)


# ── Morocco Seasonality Data ─────────────────────────────────────────

SEASON_CALENDAR = {
    1:  {"season": "low",      "label": "Basse saison",    "demand": 0.45, "margin_adj": -3, "notes": "Post-fêtes, froid Atlas"},
    2:  {"season": "low",      "label": "Basse saison",    "demand": 0.50, "margin_adj": -3, "notes": "Hiver doux, peu de demande"},
    3:  {"season": "shoulder", "label": "Mi-saison",       "demand": 0.65, "margin_adj": 0,  "notes": "Printemps commence, groupes scolaires"},
    4:  {"season": "high",     "label": "Haute saison",    "demand": 0.85, "margin_adj": +5, "notes": "Pâques, printemps idéal"},
    5:  {"season": "high",     "label": "Haute saison",    "demand": 0.80, "margin_adj": +4, "notes": "Climat parfait partout"},
    6:  {"season": "shoulder", "label": "Mi-saison",       "demand": 0.60, "margin_adj": 0,  "notes": "Début chaleur sud, MICE fin de saison"},
    7:  {"season": "low",      "label": "Basse saison",    "demand": 0.35, "margin_adj": -5, "notes": "Trop chaud pour circuits, sauf côte"},
    8:  {"season": "low",      "label": "Basse saison",    "demand": 0.30, "margin_adj": -5, "notes": "Pic chaleur, tourisme minimal"},
    9:  {"season": "shoulder", "label": "Mi-saison",       "demand": 0.65, "margin_adj": 0,  "notes": "Reprise, MICE début saison"},
    10: {"season": "peak",     "label": "Très haute saison", "demand": 0.95, "margin_adj": +7, "notes": "MICE, incentive, climat parfait"},
    11: {"season": "high",     "label": "Haute saison",    "demand": 0.80, "margin_adj": +4, "notes": "Automne doux, forte demande"},
    12: {"season": "shoulder", "label": "Mi-saison",       "demand": 0.60, "margin_adj": +2, "notes": "Noël/Nouvel An = premium ponctuel"},
}

# Lead time adjustments (days before departure)
LEAD_TIME_ADJ = {
    (0, 14):    +8,    # Last minute: +8% (urgency premium)
    (15, 30):   +4,    # Short notice: +4%
    (31, 60):   +2,    # Normal booking: +2%
    (61, 90):   0,     # Standard: no adj
    (91, 180):  -2,    # Early bird: -2%
    (181, 365): -4,    # Very early: -4% discount
}

# Group size adjustments
GROUP_ADJ = {
    (1, 10):    +5,    # Small groups: higher margin
    (11, 20):   +2,    # Medium: slight premium
    (21, 35):   0,     # Standard
    (36, 50):   -2,    # Large: volume discount
    (51, 100):  -3,    # Very large: competitive pricing
}


# ── Schemas ───────────────────────────────────────────────────────────

class MarginOptRequest(BaseModel):
    travel_month: int = Field(..., ge=1, le=12)
    pax_count: int = 20
    lead_days: int = 60
    base_margin_pct: float = 18.0
    circuit_type: str = "leisure"  # mice gets +3%


class PriceAdjustRequest(BaseModel):
    pricing_result: dict
    travel_month: int = Field(..., ge=1, le=12)
    pax_count: int = 20
    lead_days: int = 60


# ── Helpers ───────────────────────────────────────────────────────────

def _get_lead_time_adj(days: int) -> float:
    for (lo, hi), adj in LEAD_TIME_ADJ.items():
        if lo <= days <= hi:
            return adj
    return 0


def _get_group_adj(pax: int) -> float:
    for (lo, hi), adj in GROUP_ADJ.items():
        if lo <= pax <= hi:
            return adj
    return 0


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/season-calendar", summary="Morocco seasonal pricing calendar")
def season_calendar():
    """Full year seasonality calendar with demand levels and margin adjustments."""
    months = []
    for m in range(1, 13):
        data = SEASON_CALENDAR[m]
        month_name = [
            "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        ][m - 1]
        months.append({
            "month": m,
            "month_name": month_name,
            **data,
        })

    return {
        "calendar": months,
        "peak_months": [m["month"] for m in months if m["season"] == "peak"],
        "high_months": [m["month"] for m in months if m["season"] == "high"],
        "low_months": [m["month"] for m in months if m["season"] == "low"],
        "best_value_months": [m["month"] for m in months if m["margin_adj"] < 0],
    }


@router.post("/optimize-margin", summary="Get recommended margin for given parameters")
def optimize_margin(data: MarginOptRequest):
    """Calculate the optimal margin based on season, lead time, group size, and type."""
    season = SEASON_CALENDAR.get(data.travel_month, {})
    season_adj = season.get("margin_adj", 0)
    lead_adj = _get_lead_time_adj(data.lead_days)
    group_adj = _get_group_adj(data.pax_count)
    type_adj = 3 if data.circuit_type in ("mice", "incentive", "luxury") else 0

    total_adj = season_adj + lead_adj + group_adj + type_adj
    recommended = round(data.base_margin_pct + total_adj, 1)
    recommended = max(8, min(35, recommended))  # Clamp to 8-35%

    month_name = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ][data.travel_month - 1]

    return {
        "base_margin": data.base_margin_pct,
        "recommended_margin": recommended,
        "adjustments": {
            "season": {"value": season_adj, "reason": f"{month_name} — {season.get('label', '')}"},
            "lead_time": {"value": lead_adj, "reason": f"{data.lead_days} jours avant départ"},
            "group_size": {"value": group_adj, "reason": f"{data.pax_count} pax"},
            "circuit_type": {"value": type_adj, "reason": data.circuit_type},
        },
        "total_adjustment": total_adj,
        "demand_level": season.get("demand", 0.5),
        "season": season.get("season", "shoulder"),
        "notes": season.get("notes", ""),
    }


@router.post("/price-adjustment", summary="Apply yield adjustments to pricing result")
def apply_price_adjustment(data: PriceAdjustRequest):
    """Take a pricing engine result and apply yield management adjustments."""
    season = SEASON_CALENDAR.get(data.travel_month, {})
    season_adj = season.get("margin_adj", 0)
    lead_adj = _get_lead_time_adj(data.lead_days)
    group_adj = _get_group_adj(data.pax_count)

    total_adj_pct = (season_adj + lead_adj + group_adj) / 100
    multiplier = 1 + total_adj_pct

    adjusted_ranges = []
    for rng in data.pricing_result.get("ranges", []):
        a_rng = dict(rng)
        for key in ["selling_per_person", "selling_total_group", "margin_per_pax", "margin_total"]:
            if key in a_rng:
                a_rng[key] = round(a_rng[key] * multiplier, 2)
        a_rng["yield_adjustment_pct"] = round(total_adj_pct * 100, 1)
        adjusted_ranges.append(a_rng)

    adjusted_comparison = []
    for comp in data.pricing_result.get("comparison", []):
        a_comp = dict(comp)
        for key in ["selling_per_person", "total_group"]:
            if key in a_comp:
                a_comp[key] = round(a_comp[key] * multiplier, 2)
        adjusted_comparison.append(a_comp)

    return {
        "success": True,
        "adjustment_applied": round(total_adj_pct * 100, 1),
        "multiplier": round(multiplier, 4),
        "season": season.get("label", ""),
        "data": {
            "ranges": adjusted_ranges,
            "comparison": adjusted_comparison,
        },
    }


@router.get("/demand-forecast", summary="Demand forecast for next 12 months")
def demand_forecast():
    """Forecast demand based on seasonal patterns."""
    now = datetime.now(timezone.utc)
    forecast = []

    for i in range(12):
        month = ((now.month - 1 + i) % 12) + 1
        year = now.year + ((now.month - 1 + i) // 12)
        season = SEASON_CALENDAR[month]

        month_name = [
            "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
            "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
        ][month - 1]

        # Pricing strategy per demand level
        demand = season["demand"]
        if demand >= 0.9:
            strategy = "Premium pricing — forte demande, maximiser la marge"
        elif demand >= 0.7:
            strategy = "Pricing standard — demande soutenue"
        elif demand >= 0.5:
            strategy = "Pricing attractif — stimuler la demande"
        else:
            strategy = "Promotion agressive — remplir le carnet, prix d'appel"

        forecast.append({
            "month": month,
            "year": year,
            "label": f"{month_name} {year}",
            "demand_index": demand,
            "season": season["season"],
            "season_label": season["label"],
            "recommended_margin_adj": season["margin_adj"],
            "strategy": strategy,
            "notes": season["notes"],
        })

    return {"forecast": forecast, "generated_at": now.isoformat()}
