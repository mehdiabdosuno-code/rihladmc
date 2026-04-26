"""Quotation endpoints."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.quotations.schemas import (
    QuotationCreate, QuotationUpdate, QuotationResponse,
    QuotationLineCreate, QuotationLineResponse, QuotationRecalcResponse
)
from app.modules.quotations.service import QuotationService
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/quotations", tags=["quotations"], dependencies=[Depends(require_auth)])


@router.post("/", response_model=QuotationResponse, status_code=201)
def create_quotation(data: QuotationCreate, db: Session = Depends(get_db)):
    return QuotationService(db).create(data)


@router.get("/{quotation_id}", response_model=QuotationResponse)
def get_quotation(quotation_id: str, db: Session = Depends(get_db)):
    return QuotationService(db).get(quotation_id)


@router.put("/{quotation_id}", response_model=QuotationResponse)
def update_quotation(quotation_id: str, data: QuotationUpdate, db: Session = Depends(get_db)):
    return QuotationService(db).update(quotation_id, data)


@router.delete("/{quotation_id}", status_code=204)
def delete_quotation(quotation_id: str, db: Session = Depends(get_db)):
    QuotationService(db).delete(quotation_id)


@router.post("/{quotation_id}/lines", response_model=QuotationLineResponse, status_code=201)
def add_line(quotation_id: str, data: QuotationLineCreate, db: Session = Depends(get_db)):
    return QuotationService(db).add_line(quotation_id, data)


@router.post("/{quotation_id}/recalculate", response_model=QuotationRecalcResponse)
def recalculate(
    quotation_id: str,
    pax: int = Query(default=20, ge=1, le=500),
    db: Session = Depends(get_db)
):
    return QuotationService(db).recalculate(quotation_id, pax)

# ══════════════════════════════════════════════════════════════════
# NEW PRICING ENGINE — spec DMC avancée (multi-ranges, transport ceil)
# ══════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field
from typing import Optional
from app.modules.quotations.pricing_engine import (
    calculate_quotation as engine_calculate,
    calculate_range as engine_calculate_range,
)


class PaxRange(BaseModel):
    min:   int       = Field(..., ge=1, description="Min pax (base du calcul)")
    max:   Optional[int] = None
    label: Optional[str] = None


class PricingCalcRequest(BaseModel):
    ranges:     list[PaxRange]
    services:   list[dict]        # format libre; voir pricing_engine.py
    margin_pct: float = Field(default=0, ge=0, le=100)
    currency:   str   = "EUR"


@router.post("/engine/calculate",
             summary="Calcul multi-ranges avec règles DMC avancées")
def engine_calc(data: PricingCalcRequest):
    """Moteur déterministe avancé :
       - calcul sur MIN pax (jamais max)
       - transport : ceil(min_pax / capacity) × price × days
       - hôtel : price / occupancy divisor × nights
       - taxi 3/7 places · 4×4 capacité 4
       - multi-ranges avec comparaison automatique
    """
    result = engine_calculate(
        ranges=[r.model_dump() for r in data.ranges],
        services=data.services,
        margin_pct=data.margin_pct,
        currency=data.currency,
    )
    return {"success": True, "data": result}


@router.post("/engine/calculate-range",
             summary="Calcul pour UNE seule plage (aperçu temps réel)")
def engine_calc_single(
    min_pax: int = Query(..., ge=1),
    max_pax: Optional[int] = None,
    margin_pct: float = Query(default=0, ge=0, le=100),
    currency: str = Query(default="EUR"),
    services: list[dict] = None,
):
    """Utile pour les aperçus live pendant l'édition."""
    r = engine_calculate_range(
        min_pax=min_pax,
        max_pax=max_pax,
        services=services or [],
        margin_pct=margin_pct,
        currency=currency,
    )
    return {"success": True, "data": r.to_dict()}


@router.get("/engine/presets",
            summary="Listes de référence (capacités véhicules, occupancies…)")
def engine_presets():
    from app.modules.quotations.pricing_engine import (
        DEFAULT_CAPACITY, OCCUPANCY_DIVISOR,
    )
    return {
        "occupancies": [
            {"value": k, "label": k.capitalize(), "divisor": v}
            for k, v in OCCUPANCY_DIVISOR.items()
        ],
        "vehicle_capacities": [
            {"label": "Petit taxi",       "capacity": 3},
            {"label": "Grand taxi",       "capacity": 7},
            {"label": "4×4 / SUV",        "capacity": 4},
            {"label": "Minivan",          "capacity": 8},
            {"label": "Minibus 17 pl.",   "capacity": 17},
            {"label": "Minibus 25 pl.",   "capacity": 25},
            {"label": "Autocar 35 pl.",   "capacity": 35},
            {"label": "Autocar 48 pl.",   "capacity": 48},
            {"label": "Autocar 55 pl.",   "capacity": 55},
        ],
        "categories": [
            {"value": "hotel",        "label": "🏨 Hôtel"},
            {"value": "transport",    "label": "🚌 Transport"},
            {"value": "guide",        "label": "🧭 Guide"},
            {"value": "activity",     "label": "🎭 Activité"},
            {"value": "monument",     "label": "🏛 Monument"},
            {"value": "taxi",         "label": "🚕 Taxi"},
            {"value": "four_by_four", "label": "🚙 4×4"},
            {"value": "misc",         "label": "📦 Divers"},
        ],
        "currencies": ["EUR", "USD", "GBP", "MAD"],
    }


# ══════════════════════════════════════════════════════════════════
# SIMULATE CIRCUIT — Endpoint haut niveau pour le simulateur frontend
# ══════════════════════════════════════════════════════════════════

class CircuitDay(BaseModel):
    day: int
    hotel: str = ""
    formula: str = "BB"  # BB / HB / FB
    half_dbl: float = 0  # Prix chambre double / 2 (par pax)
    single_sup: float = 0
    city_tax: float = 0
    water: float = 0
    restaurant: str = ""
    rest_price: float = 0
    monument: str = ""
    monu_price: float = 0
    local_guide: float = 0

class CircuitVariableCost(BaseModel):
    key: str           # ex: "bus", "guide", "taxi_chef"
    label: str         # ex: "Autocar 48 places"
    total_group: float # coût total pour le groupe entier

class SimulateCircuitRequest(BaseModel):
    days: list[CircuitDay]
    variable_costs: list[CircuitVariableCost]
    margin_pct: float = Field(default=8, ge=0, le=100)
    currency: str = "MAD"
    pax_tiers: list[int] = Field(default=[10, 15, 20, 25, 30, 35])
    exchange_rate: float = Field(default=10.1, description="MAD per 1 USD")


@router.post("/engine/simulate-circuit",
             summary="Simulateur haut niveau — circuit jour-par-jour → grille PAX")
def simulate_circuit(data: SimulateCircuitRequest):
    """
    Transforme un itinéraire jour-par-jour + coûts variables en
    une grille de prix multi-ranges utilisant le pricing_engine.

    Le frontend envoie les données brutes du circuit,
    le backend fait TOUS les calculs et renvoie la grille complète.
    """
    # 1. Construire les services depuis les jours
    services: list[dict] = []

    # Hôtels : chaque nuit = 1 service
    for d in data.days:
        if d.half_dbl > 0:
            services.append({
                "id": f"htl-{d.day}",
                "category": "hotel",
                "name": f"{d.hotel} (J{d.day})",
                "price_per_room": d.half_dbl * 2,  # reconvertir en prix chambre
                "occupancy": "double",
                "nights": 1,
            })

    # Restaurants : chaque repas = 1 service misc per_person
    for d in data.days:
        if d.rest_price > 0:
            services.append({
                "id": f"rst-{d.day}",
                "category": "misc",
                "name": f"{d.restaurant} (J{d.day})",
                "price": d.rest_price,
            })

    # Monuments
    for d in data.days:
        if d.monu_price > 0:
            services.append({
                "id": f"mon-{d.day}",
                "category": "monument",
                "name": f"{d.monument} (J{d.day})",
                "price": d.monu_price,
                "pricing_mode": "per_person",
            })

    # Taxes
    total_tax = sum(d.city_tax for d in data.days)
    if total_tax > 0:
        services.append({
            "id": "tax-total",
            "category": "misc",
            "name": "Taxes de séjour",
            "price": total_tax,
        })

    # Eau
    total_water = sum(d.water for d in data.days)
    if total_water > 0:
        services.append({
            "id": "water-total",
            "category": "misc",
            "name": "Eau minérale",
            "price": total_water,
        })

    # Guides locaux (fixe per pax)
    total_lg = sum(d.local_guide for d in data.days)
    if total_lg > 0:
        services.append({
            "id": "lg-total",
            "category": "misc",
            "name": "Guides locaux",
            "price": total_lg,
        })

    # 2. Ajouter les coûts variables comme des services "guide" ou "transport"
    for vc in data.variable_costs:
        if vc.key == "bus":
            services.append({
                "id": f"var-{vc.key}",
                "category": "transport",
                "name": vc.label,
                "price_per_vehicle": vc.total_group,
                "vehicle_capacity": 999,  # 1 seul véhicule (forfait)
                "days": 1,
            })
        else:
            services.append({
                "id": f"var-{vc.key}",
                "category": "guide",
                "name": vc.label,
                "daily_cost": vc.total_group,
                "days": 1,
            })

    # 3. Construire les ranges
    ranges = [{"min": p, "max": p, "label": f"{p} pax"} for p in data.pax_tiers]

    # 4. Calculer via le moteur
    result = engine_calculate(
        ranges=ranges,
        services=services,
        margin_pct=data.margin_pct,
        currency=data.currency,
    )

    # 5. Calculer le supplément single total
    single_total = sum(d.single_sup for d in data.days)

    # 6. Enrichir avec USD et single
    grid = []
    for r_item in result["ranges"]:
        grid.append({
            "pax": r_item["range_min"],
            "cost_per_pax": r_item["cost_per_person"],
            "selling_per_pax": r_item["selling_per_person"],
            "margin_per_pax": r_item["margin_per_pax"],
            "total_group": r_item["selling_total_group"],
            "usd_per_pax": round(r_item["selling_per_person"] / data.exchange_rate, 2),
            "by_category": r_item["by_category"],
            "warnings": r_item["warnings"],
        })

    # Summary metrics based on the first range
    first_r = result["ranges"][0] if result["ranges"] else {}
    fixed_pp = sum(first_r.get("by_category", {}).get(c, 0) for c in ["hotel", "misc", "monument"])
    var_grp  = sum(first_r.get("by_category", {}).get(c, 0) for c in ["transport", "guide"]) * (first_r.get("range_min") or 1)

    return {
        "success": True,
        "data": {
            "grid": grid,
            "single_supplement": single_total,
            "fixed_per_pax": round(fixed_pp, 2),
            "variable_group": round(var_grp, 2),
            "summary": result["summary"],
            "currency": data.currency,
            "exchange_rate": data.exchange_rate,
        },
    }
