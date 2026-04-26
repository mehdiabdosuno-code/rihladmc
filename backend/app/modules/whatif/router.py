"""What-If Pricing Simulator — Real-time pricing impact analysis.

Allows modifications to the pricing without altering the original quotation:
  - Change hotel category on specific nights
  - Add/remove services
  - Adjust margin
  - Change pax count
  - Swap meal plans
  - Compare original vs modified pricing

Uses the pricing_engine in pure function mode (zero side effects).
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.modules.quotations.models import Quotation, QuotationLine
from app.modules.projects.models import Project
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/whatif", tags=["what-if-simulator"],
                   dependencies=[Depends(require_auth)])


# ── Schemas ──────────────────────────────────────────────────────────

class ServiceModification(BaseModel):
    """Single modification to apply to a service."""
    action: str  # "change_price" | "remove" | "add" | "change_category" | "change_meal"
    line_index: Optional[int] = None  # Index in the services list
    category: Optional[str] = None
    label: Optional[str] = None
    new_price: Optional[float] = None
    new_quantity: Optional[float] = None
    day_number: Optional[int] = None
    unit: Optional[str] = None
    cost_type: Optional[str] = None


class WhatIfRequest(BaseModel):
    """Complete what-if simulation request."""
    project_id: Optional[str] = None
    # Provide services directly or load from project
    services: Optional[list[dict]] = None
    # Modifications to apply
    modifications: list[ServiceModification] = []
    # Global adjustments
    new_margin_pct: Optional[float] = None
    new_pax_ranges: Optional[list[dict]] = None
    # Original for comparison
    original_margin_pct: float = 18.0
    original_pax_ranges: Optional[list[dict]] = None


class QuickHotelSwap(BaseModel):
    """Quick hotel category swap."""
    project_id: str
    nights: list[int] = []  # Which nights to swap (empty = all)
    from_category: str = "5*"
    to_category: str = "4*"
    price_multiplier: float = 0.65  # 4* is ~65% of 5*


class QuickMarginAdjust(BaseModel):
    """Quick margin adjustment."""
    project_id: str
    new_margin_pct: float = Field(..., ge=0, le=50)


class QuickMealSwap(BaseModel):
    """Swap meal plan across the circuit."""
    project_id: str
    from_plan: str = "HB"  # HB, FB, BB
    to_plan: str = "BB"
    price_multiplier: float = 0.6


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/simulate", summary="Run what-if simulation")
def simulate(data: WhatIfRequest, db: Session = Depends(get_db)):
    """Run a what-if pricing simulation without modifying the actual quotation.

    Loads services from the project quotation (or uses provided services),
    applies modifications, and returns original vs modified comparison.
    """
    from app.modules.quotations.pricing_engine import calculate_quotation

    services = data.services or []

    # Load from project if needed
    if data.project_id and not services:
        quotation = db.execute(
            select(Quotation)
            .where(Quotation.project_id == data.project_id)
            .options(selectinload(Quotation.lines))
        ).scalars().first()
        if quotation:
            services = [
                {
                    "category": str(l.category) if l.category else "misc",
                    "label": l.label,
                    "unit_cost": float(l.unit_cost or 0),
                    "quantity": float(l.quantity or 1),
                    "unit": l.unit or "group",
                    "cost_type": (l.unit or "group"),
                    "day_number": l.day_number,
                    "city": l.city,
                }
                for l in quotation.lines
            ]

    if not services:
        raise HTTPException(400, "No services to simulate. Provide services or a valid project_id.")

    # Calculate original
    original_margin = data.original_margin_pct
    original_ranges = data.original_pax_ranges or [{"min": 20, "max": 30}]

    original = calculate_quotation(
        ranges=original_ranges,
        services=services,
        margin_pct=original_margin,
        currency="EUR",
    )

    # Apply modifications to a copy
    modified_services = [s.copy() for s in services]

    removed_labels = []
    added_labels = []
    changed_labels = []

    for mod in data.modifications:
        if mod.action == "remove" and mod.line_index is not None:
            if 0 <= mod.line_index < len(modified_services):
                removed_labels.append(modified_services[mod.line_index].get("label", "?"))
                modified_services[mod.line_index] = None  # Mark for removal

        elif mod.action == "change_price" and mod.line_index is not None:
            if 0 <= mod.line_index < len(modified_services) and modified_services[mod.line_index]:
                old_price = modified_services[mod.line_index]["unit_cost"]
                if mod.new_price is not None:
                    modified_services[mod.line_index]["unit_cost"] = mod.new_price
                if mod.new_quantity is not None:
                    modified_services[mod.line_index]["quantity"] = mod.new_quantity
                changed_labels.append(
                    f"{modified_services[mod.line_index]['label']}: "
                    f"{old_price:.0f}→{mod.new_price:.0f}"
                )

        elif mod.action == "change_category":
            # Change all services of a category
            for s in modified_services:
                if s and s.get("category") == mod.category:
                    if mod.new_price is not None:
                        s["unit_cost"] = mod.new_price
                    changed_labels.append(f"Category {mod.category} adjusted")

        elif mod.action == "add":
            new_service = {
                "category": mod.category or "misc",
                "label": mod.label or "New service",
                "unit_cost": mod.new_price or 0,
                "quantity": mod.new_quantity or 1,
                "unit": mod.unit or "group",
                "cost_type": mod.cost_type or "group",
                "day_number": mod.day_number,
            }
            modified_services.append(new_service)
            added_labels.append(mod.label or "New service")

    # Remove None entries
    modified_services = [s for s in modified_services if s is not None]

    # Calculate modified
    mod_margin = data.new_margin_pct if data.new_margin_pct is not None else original_margin
    mod_ranges = data.new_pax_ranges or original_ranges

    modified = calculate_quotation(
        ranges=mod_ranges,
        services=modified_services,
        margin_pct=mod_margin,
        currency="EUR",
    )

    # Build comparison
    comparison = []
    for orig_r, mod_r in zip(original["ranges"], modified["ranges"]):
        diff_cost = mod_r["cost_per_person"] - orig_r["cost_per_person"]
        diff_sell = mod_r["selling_per_person"] - orig_r["selling_per_person"]
        diff_pct = (diff_sell / orig_r["selling_per_person"] * 100) if orig_r["selling_per_person"] else 0

        comparison.append({
            "range": orig_r.get("range_label", orig_r.get("label", "")),
            "original_cost_pp": orig_r["cost_per_person"],
            "modified_cost_pp": mod_r["cost_per_person"],
            "original_sell_pp": orig_r["selling_per_person"],
            "modified_sell_pp": mod_r["selling_per_person"],
            "diff_cost_pp": round(diff_cost, 2),
            "diff_sell_pp": round(diff_sell, 2),
            "diff_pct": round(diff_pct, 1),
            "impact": "cheaper" if diff_sell < 0 else "same" if diff_sell == 0 else "more_expensive",
        })

    return {
        "original": original,
        "modified": modified,
        "comparison": comparison,
        "changes_applied": {
            "removed": removed_labels,
            "added": added_labels,
            "changed": changed_labels,
            "margin_changed": data.new_margin_pct is not None,
            "original_margin": original_margin,
            "new_margin": mod_margin,
        },
    }


@router.post("/hotel-swap", summary="Quick hotel category swap")
def hotel_swap(data: QuickHotelSwap, db: Session = Depends(get_db)):
    """Simulate swapping hotel category on specific nights.

    Example: Switch from 5* to 4* on nights 3-5 to reduce cost.
    """
    from app.modules.quotations.pricing_engine import calculate_quotation

    quotation = db.execute(
        select(Quotation)
        .where(Quotation.project_id == data.project_id)
        .options(selectinload(Quotation.lines))
    ).scalars().first()

    if not quotation:
        raise HTTPException(404, "No quotation found")

    services_original = []
    services_modified = []

    for l in quotation.lines:
        s = {
            "category": str(l.category) if l.category else "misc",
            "label": l.label,
            "unit_cost": float(l.unit_cost or 0),
            "quantity": float(l.quantity or 1),
            "unit": l.unit or "group",
            "cost_type": l.unit or "group",
            "day_number": l.day_number,
        }
        services_original.append(s)

        s_mod = s.copy()
        is_hotel = str(l.category) == "hotel"
        target_night = (not data.nights) or (l.day_number in data.nights)

        if is_hotel and target_night:
            s_mod["unit_cost"] = round(float(l.unit_cost or 0) * data.price_multiplier, 2)
            s_mod["label"] = l.label.replace(data.from_category, data.to_category) if l.label else l.label

        services_modified.append(s_mod)

    margin = float(quotation.margin_pct or 18)
    ranges = [{"min": 20, "max": 30}]

    original = calculate_quotation(ranges=ranges, services=services_original, margin_pct=margin)
    modified = calculate_quotation(ranges=ranges, services=services_modified, margin_pct=margin)

    orig_pp = original["ranges"][0]["selling_per_person"]
    mod_pp = modified["ranges"][0]["selling_per_person"]

    return {
        "scenario": f"Hotel swap: {data.from_category} → {data.to_category}",
        "nights_affected": data.nights or "all",
        "original_price_pp": orig_pp,
        "modified_price_pp": mod_pp,
        "savings_pp": round(orig_pp - mod_pp, 2),
        "savings_pct": round((orig_pp - mod_pp) / orig_pp * 100, 1) if orig_pp else 0,
        "original": original,
        "modified": modified,
    }


@router.post("/margin-adjust", summary="Quick margin adjustment")
def margin_adjust(data: QuickMarginAdjust, db: Session = Depends(get_db)):
    """Simulate margin change and see impact on selling price."""
    from app.modules.quotations.pricing_engine import calculate_quotation

    quotation = db.execute(
        select(Quotation)
        .where(Quotation.project_id == data.project_id)
        .options(selectinload(Quotation.lines))
    ).scalars().first()

    if not quotation:
        raise HTTPException(404, "No quotation found")

    services = [
        {
            "category": str(l.category) if l.category else "misc",
            "label": l.label,
            "unit_cost": float(l.unit_cost or 0),
            "quantity": float(l.quantity or 1),
            "unit": l.unit or "group",
            "cost_type": l.unit or "group",
        }
        for l in quotation.lines
    ]

    ranges = [{"min": 20, "max": 30}]
    original_margin = float(quotation.margin_pct or 18)

    original = calculate_quotation(ranges=ranges, services=services, margin_pct=original_margin)
    modified = calculate_quotation(ranges=ranges, services=services, margin_pct=data.new_margin_pct)

    orig_pp = original["ranges"][0]["selling_per_person"]
    mod_pp = modified["ranges"][0]["selling_per_person"]

    return {
        "scenario": f"Margin: {original_margin}% → {data.new_margin_pct}%",
        "original_margin": original_margin,
        "new_margin": data.new_margin_pct,
        "original_price_pp": orig_pp,
        "modified_price_pp": mod_pp,
        "diff_pp": round(mod_pp - orig_pp, 2),
        "diff_pct": round((mod_pp - orig_pp) / orig_pp * 100, 1) if orig_pp else 0,
    }


@router.post("/meal-swap", summary="Quick meal plan swap")
def meal_swap(data: QuickMealSwap, db: Session = Depends(get_db)):
    """Simulate changing meal plan (FB→HB, HB→BB, etc.)."""
    from app.modules.quotations.pricing_engine import calculate_quotation

    quotation = db.execute(
        select(Quotation)
        .where(Quotation.project_id == data.project_id)
        .options(selectinload(Quotation.lines))
    ).scalars().first()

    if not quotation:
        raise HTTPException(404, "No quotation found")

    services_original = []
    services_modified = []

    for l in quotation.lines:
        s = {
            "category": str(l.category) if l.category else "misc",
            "label": l.label,
            "unit_cost": float(l.unit_cost or 0),
            "quantity": float(l.quantity or 1),
            "unit": l.unit or "group",
            "cost_type": l.unit or "group",
        }
        services_original.append(s)

        s_mod = s.copy()
        is_meal = str(l.category) == "restaurant" or "repas" in (l.label or "").lower() or "dîner" in (l.label or "").lower() or "déjeuner" in (l.label or "").lower()
        if is_meal:
            s_mod["unit_cost"] = round(float(l.unit_cost or 0) * data.price_multiplier, 2)
        services_modified.append(s_mod)

    margin = float(quotation.margin_pct or 18)
    ranges = [{"min": 20, "max": 30}]

    original = calculate_quotation(ranges=ranges, services=services_original, margin_pct=margin)
    modified = calculate_quotation(ranges=ranges, services=services_modified, margin_pct=margin)

    orig_pp = original["ranges"][0]["selling_per_person"]
    mod_pp = modified["ranges"][0]["selling_per_person"]

    return {
        "scenario": f"Meal plan: {data.from_plan} → {data.to_plan}",
        "original_price_pp": orig_pp,
        "modified_price_pp": mod_pp,
        "savings_pp": round(orig_pp - mod_pp, 2),
        "savings_pct": round((orig_pp - mod_pp) / orig_pp * 100, 1) if orig_pp else 0,
    }
