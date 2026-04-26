"""Pricing engine — deterministic DMC calculation engine.

CRITICAL RULE: all per-person costs use MIN pax of the range (never max).
This guarantees the quoted price never underestimates actual cost.

Service categories:
    hotel         → per-room pricing / occupancy divisor × nights
    transport     → ceil(min_pax / capacity) × price × days ÷ min_pax
    guide         → daily_cost × days ÷ min_pax
    activity      → per_person (direct) OR total (÷ min_pax)
    monument      → same as activity
    taxi          → transport with capacity 3 (petit) or 7 (grand)
    four_by_four  → transport with capacity 4
    misc          → per_person direct

This module has ZERO database dependencies — pure functions, easy to test.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Literal
import math


# ─── Constants ────────────────────────────────────────────────────
OCCUPANCY_DIVISOR: dict[str, int] = {
    "single":     1,
    "double":     2,
    "triple":     3,
    "quadruple":  4,
}

DEFAULT_CAPACITY: dict[str, int] = {
    "taxi_small":    3,   # Petit taxi (Maroc)
    "taxi_large":    7,   # Grand taxi
    "four_by_four":  4,
    "minivan":       8,
    "minibus_17":    17,
    "minibus_25":    25,
    "coach_35":      35,
    "coach_48":      48,
    "coach_55":      55,
}

Category = Literal[
    "hotel", "transport", "guide", "activity", "monument",
    "taxi", "four_by_four", "misc",
]


# ─── Helpers ──────────────────────────────────────────────────────
def round2(n: float) -> float:
    """Round to 2 decimals, avoiding float artifacts."""
    return round(float(n) + 1e-9, 2)


def ceil_up(n: float) -> int:
    """Always round UP (strict ceil for non-integers). 2.14 → 3, 2.0 → 2."""
    return math.ceil(n - 1e-9)


# ─── Result dataclasses ───────────────────────────────────────────
@dataclass
class ServiceResult:
    """Result of calculating a single service for a given min_pax."""
    service_id:         str | None
    service_name:       str
    category:           str
    cost_per_person:    float
    total_cost:         float
    calculation_detail: str
    meta:               dict[str, Any] = field(default_factory=dict)
    warnings:           list[str]       = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RangeResult:
    """Full calculation for one pax range."""
    range_min:           int
    range_max:           int
    range_label:         str
    basis:               int      # = range_min (explicit for clarity)
    currency:            str
    margin_pct:          float
    services:            list[ServiceResult]
    by_category:         dict[str, float]
    cost_per_person:     float
    cost_total_group:    float
    selling_per_person:  float
    selling_total_group: float
    margin_per_pax:      float
    margin_total:        float
    warnings:            list[str]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["services"] = [s.to_dict() if hasattr(s, "to_dict") else s for s in self.services]
        return d


# ─── Per-service calculators ──────────────────────────────────────
def _hotel(service: dict, min_pax: int) -> ServiceResult:
    price    = float(service.get("price_per_room", 0))
    occ      = str(service.get("occupancy", "double")).lower()
    nights   = int(service.get("nights", 1))
    divisor  = OCCUPANCY_DIVISOR.get(occ, 2)

    per_person = (price / divisor) * nights
    total      = per_person * min_pax

    return ServiceResult(
        service_id=service.get("id"),
        service_name=service.get("name") or service.get("label") or "Hôtel",
        category="hotel",
        cost_per_person=round2(per_person),
        total_cost=round2(total),
        calculation_detail=(
            f"{price:.0f} / {divisor} ({occ}) × {nights} nuit{'s' if nights>1 else ''} "
            f"= {round2(per_person)}/pax"
        ),
        meta={"nights": nights, "occupancy": occ, "price_per_room": price,
              "divisor": divisor},
    )


def _transport(service: dict, min_pax: int) -> ServiceResult:
    """CRITICAL: ceil(min_pax / capacity) × price × days ÷ min_pax"""
    price    = float(service.get("price_per_vehicle", 0))
    capacity = int(service.get("vehicle_capacity", 1))
    days     = int(service.get("days", 1))

    if capacity <= 0:
        return ServiceResult(
            service_id=service.get("id"),
            service_name=service.get("name") or "Transport",
            category="transport",
            cost_per_person=0, total_cost=0,
            calculation_detail="⚠ Capacité véhicule invalide (> 0 requis)",
            warnings=["Capacité véhicule invalide"],
        )

    vehicles   = ceil_up(min_pax / capacity)
    total      = vehicles * price * days
    per_person = total / min_pax

    detail = (
        f"{min_pax} pax / {capacity} places = {vehicles} véhicule"
        f"{'s' if vehicles > 1 else ''}"
        + (f" × {days} jours" if days > 1 else "")
        + f" × {price:.0f} = {round2(total)} ÷ {min_pax} = {round2(per_person)}/pax"
    )

    warnings: list[str] = []
    if vehicles * capacity > min_pax * 1.5:
        warnings.append(
            f"Sur-capacité : {vehicles * capacity} places pour {min_pax} pax — "
            f"négocier un tarif spécial ?"
        )

    return ServiceResult(
        service_id=service.get("id"),
        service_name=service.get("name") or "Transport",
        category="transport",
        cost_per_person=round2(per_person),
        total_cost=round2(total),
        calculation_detail=detail,
        meta={
            "vehicles": vehicles, "capacity": capacity, "days": days,
            "total_seats": vehicles * capacity,
        },
        warnings=warnings,
    )


def _guide(service: dict, min_pax: int) -> ServiceResult:
    daily      = float(service.get("daily_cost", 0))
    days       = int(service.get("days", 1))
    total      = daily * days
    per_person = total / min_pax

    return ServiceResult(
        service_id=service.get("id"),
        service_name=service.get("name") or "Guide",
        category="guide",
        cost_per_person=round2(per_person),
        total_cost=round2(total),
        calculation_detail=(
            f"{daily:.0f}/jour × {days} jour{'s' if days>1 else ''} = {round2(total)} "
            f"÷ {min_pax} pax = {round2(per_person)}/pax"
        ),
        meta={"days": days, "daily_cost": daily},
    )


def _activity(service: dict, min_pax: int) -> ServiceResult:
    price     = float(service.get("price", 0))
    mode      = str(service.get("pricing_mode", "per_person")).lower()
    category  = service.get("category", "activity")
    cat_name  = "Monument" if category == "monument" else "Activité"

    if mode == "per_person":
        per_person = price
        total      = price * min_pax
        detail     = f"{price:.0f}/pax (par personne) × {min_pax} pax = {round2(total)}"
    else:
        per_person = price / min_pax
        total      = price
        detail     = f"{price:.0f} total ÷ {min_pax} pax = {round2(per_person)}/pax"

    return ServiceResult(
        service_id=service.get("id"),
        service_name=service.get("name") or cat_name,
        category=category,
        cost_per_person=round2(per_person),
        total_cost=round2(total),
        calculation_detail=detail,
        meta={"pricing_mode": mode},
    )


def _taxi(service: dict, min_pax: int) -> ServiceResult:
    taxi_type = str(service.get("taxi_type", "large")).lower()
    capacity  = int(service.get("vehicle_capacity") or
                    DEFAULT_CAPACITY[f"taxi_{taxi_type}"])
    return _transport({**service, "vehicle_capacity": capacity}, min_pax)


def _four_by_four(service: dict, min_pax: int) -> ServiceResult:
    return _transport({**service, "vehicle_capacity": 4}, min_pax)


def _misc(service: dict, min_pax: int) -> ServiceResult:
    price = float(service.get("price", 0))
    total = price * min_pax
    return ServiceResult(
        service_id=service.get("id"),
        service_name=service.get("name") or "Divers",
        category="misc",
        cost_per_person=round2(price),
        total_cost=round2(total),
        calculation_detail=f"{price:.0f}/pax × {min_pax} pax = {round2(total)}",
        meta={},
    )


# ─── Dispatcher ───────────────────────────────────────────────────
_CALCULATORS = {
    "hotel":        _hotel,
    "transport":    _transport,
    "guide":        _guide,
    "activity":     _activity,
    "monument":     _activity,
    "taxi":         _taxi,
    "four_by_four": _four_by_four,
    "misc":         _misc,
}


def calculate_service(service: dict, min_pax: int) -> ServiceResult:
    """Calculate a single service for a given MIN pax."""
    category = str(service.get("category", "misc")).lower()
    fn = _CALCULATORS.get(category, _misc)
    try:
        return fn(service, min_pax)
    except Exception as e:
        return ServiceResult(
            service_id=service.get("id"),
            service_name=service.get("name") or category,
            category=category,
            cost_per_person=0, total_cost=0,
            calculation_detail=f"⚠ Erreur : {e}",
            warnings=[str(e)],
        )


def calculate_range(
    min_pax: int,
    max_pax: int | None,
    services: list[dict],
    margin_pct: float = 0,
    currency: str = "EUR",
    label: str | None = None,
) -> RangeResult:
    """Calculate pricing for one group range, based on min_pax."""
    if not isinstance(min_pax, int) or min_pax < 1:
        raise ValueError(f"min_pax invalide : doit être un entier ≥ 1 (reçu: {min_pax!r})")
    max_pax = max_pax or min_pax
    if max_pax < min_pax:
        raise ValueError(f"max_pax ({max_pax}) < min_pax ({min_pax})")

    # Calculate each service
    results = [
        calculate_service(s, min_pax)
        for s in services
        if s and s.get("active", True)
    ]

    # Aggregate
    cost_per_person = sum(r.cost_per_person for r in results)
    cost_total      = cost_per_person * min_pax

    by_category: dict[str, float] = {}
    for r in results:
        by_category[r.category] = round2(by_category.get(r.category, 0) + r.cost_per_person)

    # Margin
    margin_mult = 1 + (margin_pct / 100)
    selling_pp  = cost_per_person * margin_mult
    selling_tot = selling_pp * min_pax
    margin_pp   = selling_pp - cost_per_person

    warnings = [w for r in results for w in r.warnings]

    return RangeResult(
        range_min=min_pax,
        range_max=max_pax,
        range_label=label or f"{min_pax}–{max_pax} pax",
        basis=min_pax,
        currency=currency,
        margin_pct=margin_pct,
        services=results,
        by_category=by_category,
        cost_per_person=round2(cost_per_person),
        cost_total_group=round2(cost_total),
        selling_per_person=round2(selling_pp),
        selling_total_group=round2(selling_tot),
        margin_per_pax=round2(margin_pp),
        margin_total=round2(margin_pp * min_pax),
        warnings=warnings,
    )


def calculate_quotation(
    ranges: list[dict],
    services: list[dict],
    margin_pct: float = 0,
    currency: str = "EUR",
) -> dict:
    """Calculate a multi-range quotation. Returns a dict with comparison."""
    if not ranges:
        raise ValueError("Au moins une plage est requise")

    results = [
        calculate_range(
            min_pax=int(r["min"]),
            max_pax=int(r.get("max", r["min"])),
            services=services,
            margin_pct=margin_pct,
            currency=currency,
            label=r.get("label"),
        )
        for r in ranges
    ]

    comparison = [
        {
            "range":                r.range_label,
            "basis":                r.basis,
            "cost_per_person":      r.cost_per_person,
            "selling_per_person":   r.selling_per_person,
            "total_group":          r.selling_total_group,
        }
        for r in results
    ]

    sorted_by_price = sorted(comparison, key=lambda x: x["selling_per_person"])

    return {
        "ranges":     [r.to_dict() for r in results],
        "comparison": comparison,
        "summary": {
            "lowest_per_person":  sorted_by_price[0]  if sorted_by_price else None,
            "highest_per_person": sorted_by_price[-1] if sorted_by_price else None,
            "range_count":        len(results),
            "service_count":      len(services),
            "currency":           currency,
            "margin_pct":         margin_pct,
        },
    }
