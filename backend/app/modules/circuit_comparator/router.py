"""Circuit Comparator — Compare 2-3 circuit variants side by side.

Core differentiator: allows commercial teams to present clients with
Luxe vs Standard vs Budget options, with visual diffs on hotels,
activities, pricing, and inclusions.

Endpoints:
  POST /comparator/generate       — Generate 2-3 variants from a base circuit
  POST /comparator/compare        — Compare existing projects side by side
  POST /comparator/diff           — Show detailed diff between two circuits
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.ai.travel_designer import CITIES, generate_circuit
from app.modules.quotations.pricing_engine import calculate_quotation
from app.shared.dependencies import require_auth

router = APIRouter(
    prefix="/comparator",
    tags=["circuit-comparator"],
    dependencies=[Depends(require_auth)],
)


# ── Hotel tiers for variant generation ────────────────────────────────
TIER_CONFIG = {
    "luxe": {
        "label": "Luxe",
        "hotel_category": "5*",
        "meal_plan": "FB",
        "price_multiplier": 1.0,
        "color": "#C5943A",
        "includes_extras": True,
        "extra_activities": ["Dîner de gala", "Spa privé", "Team-building premium"],
    },
    "confort": {
        "label": "Confort",
        "hotel_category": "4*",
        "meal_plan": "HB",
        "price_multiplier": 0.65,
        "color": "#3182CE",
        "includes_extras": False,
        "extra_activities": [],
    },
    "essentiel": {
        "label": "Essentiel",
        "hotel_category": "4*",
        "meal_plan": "BB",
        "price_multiplier": 0.45,
        "color": "#38A169",
        "includes_extras": False,
        "extra_activities": [],
    },
}


# ── Schemas ───────────────────────────────────────────────────────────

class VariantRequest(BaseModel):
    """Generate circuit variants from specifications."""
    cities: list[str]
    duration_days: int = 8
    circuit_type: str = "leisure"
    tiers: list[str] = Field(default=["luxe", "confort", "essentiel"])
    pax_ranges: list[dict] = Field(default=[{"min": 20, "max": 30}])
    margin_pct: float = 18.0
    language: str = "fr"


class CompareRequest(BaseModel):
    """Compare existing projects by ID."""
    project_ids: list[str] = Field(..., min_length=2, max_length=4)


class DiffRequest(BaseModel):
    """Detailed diff between two project IDs."""
    project_a: str
    project_b: str


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/generate", summary="Generate 2-3 circuit variants (Luxe / Confort / Essentiel)")
def generate_variants(data: VariantRequest):
    """Generate multiple circuit variants from the same route with different
    hotel tiers, meal plans, and extras. Each variant includes full pricing."""

    variants = []

    for tier_key in data.tiers:
        tier = TIER_CONFIG.get(tier_key)
        if not tier:
            continue

        # Generate circuit with this tier's settings
        circuit = generate_circuit(
            client_brief=f"Circuit {tier['label']}",
            duration_days=data.duration_days,
            hotel_category=tier["hotel_category"],
            meal_plan=tier["meal_plan"],
            cities=data.cities,
            circuit_type=data.circuit_type,
            language=data.language,
        )

        # Adjust service prices based on tier multiplier
        adjusted_services = []
        for svc in circuit.estimated_services:
            s = dict(svc)
            if svc["category"] == "hotel":
                s["price_per_room"] = round(svc["price_per_room"] * tier["price_multiplier"], 2)
            adjusted_services.append(s)

        # Add extra activities for luxury tier
        if tier["includes_extras"]:
            for i, extra in enumerate(tier["extra_activities"]):
                adjusted_services.append({
                    "id": f"extra_{i}",
                    "category": "activity",
                    "name": extra,
                    "price": 65,
                    "pricing_mode": "per_person",
                })

        # Calculate pricing
        pricing = calculate_quotation(
            ranges=data.pax_ranges,
            services=adjusted_services,
            margin_pct=data.margin_pct,
            currency="EUR",
        )

        variant = circuit.to_dict()
        variant["tier"] = tier_key
        variant["tier_label"] = tier["label"]
        variant["tier_color"] = tier["color"]
        variant["hotel_category"] = tier["hotel_category"]
        variant["meal_plan"] = tier["meal_plan"]
        variant["pricing"] = pricing
        variant["services"] = adjusted_services

        # Summary stats
        if pricing and pricing.get("ranges"):
            first_range = pricing["ranges"][0]
            variant["price_per_person"] = first_range["selling_per_person"]
            variant["cost_per_person"] = first_range["cost_per_person"]
        else:
            variant["price_per_person"] = 0
            variant["cost_per_person"] = 0

        variants.append(variant)

    # Build comparison matrix
    comparison = {
        "variants_count": len(variants),
        "route": " → ".join(data.cities),
        "duration": f"{data.duration_days}J/{data.duration_days - 1}N",
        "matrix": [],
    }

    for v in variants:
        comparison["matrix"].append({
            "tier": v["tier_label"],
            "color": v["tier_color"],
            "hotel_category": v["hotel_category"],
            "meal_plan": v["meal_plan"],
            "price_per_person": v["price_per_person"],
            "cost_per_person": v["cost_per_person"],
            "services_count": len(v.get("services", [])),
            "includes_extras": TIER_CONFIG.get(v["tier"], {}).get("includes_extras", False),
        })

    # Price savings
    if len(variants) >= 2:
        prices = [v["price_per_person"] for v in variants if v["price_per_person"] > 0]
        if prices:
            comparison["price_range"] = {
                "min": min(prices),
                "max": max(prices),
                "savings_pct": round((1 - min(prices) / max(prices)) * 100, 1) if max(prices) > 0 else 0,
            }

    return {
        "success": True,
        "data": {
            "variants": variants,
            "comparison": comparison,
        },
    }


@router.post("/compare", summary="Compare existing projects side by side")
def compare_projects(data: CompareRequest, db: Session = Depends(get_db)):
    """Compare 2-4 existing projects with their itineraries."""

    projects_data = []

    for pid in data.project_ids:
        project = db.get(Project, pid)
        if not project:
            raise HTTPException(404, f"Project {pid} not found")

        # Get itinerary
        itin = db.execute(
            select(Itinerary).where(Itinerary.project_id == pid)
        ).scalars().first()

        days = []
        cities = []
        if itin:
            day_rows = db.execute(
                select(ItineraryDay)
                .where(ItineraryDay.itinerary_id == itin.id)
                .order_by(ItineraryDay.day_number)
            ).scalars().all()
            for d in day_rows:
                days.append({
                    "day_number": d.day_number,
                    "city": d.city,
                    "title": d.title,
                    "hotel": d.hotel,
                    "hotel_category": d.hotel_category,
                    "meal_plan": d.meal_plan,
                    "activities": d.activities or [],
                })
                if d.city and d.city not in cities:
                    cities.append(d.city)

        projects_data.append({
            "id": project.id,
            "name": project.name,
            "client_name": project.client_name,
            "destination": project.destination,
            "duration_days": project.duration_days,
            "duration_nights": project.duration_nights,
            "project_type": str(project.project_type) if project.project_type else None,
            "pax_count": project.pax_count,
            "status": str(project.status),
            "cities": cities,
            "days": days,
            "highlights": project.highlights or [],
            "inclusions": project.inclusions or [],
            "exclusions": project.exclusions or [],
        })

    # Build diff matrix
    diff_items = []
    if len(projects_data) >= 2:
        a, b = projects_data[0], projects_data[1]

        # Cities diff
        cities_a = set(a.get("cities", []))
        cities_b = set(b.get("cities", []))
        diff_items.append({
            "field": "cities",
            "a": list(cities_a),
            "b": list(cities_b),
            "common": list(cities_a & cities_b),
            "only_a": list(cities_a - cities_b),
            "only_b": list(cities_b - cities_a),
        })

        # Duration diff
        diff_items.append({
            "field": "duration",
            "a": a.get("duration_days"),
            "b": b.get("duration_days"),
            "same": a.get("duration_days") == b.get("duration_days"),
        })

        # Hotels diff
        hotels_a = [d.get("hotel") for d in a.get("days", []) if d.get("hotel")]
        hotels_b = [d.get("hotel") for d in b.get("days", []) if d.get("hotel")]
        diff_items.append({
            "field": "hotels",
            "a": hotels_a,
            "b": hotels_b,
        })

    return {
        "projects": projects_data,
        "diff": diff_items,
        "count": len(projects_data),
    }


@router.post("/diff", summary="Detailed diff between two circuits")
def diff_circuits(data: DiffRequest, db: Session = Depends(get_db)):
    """Generate a line-by-line diff between two project itineraries."""
    compare_req = CompareRequest(project_ids=[data.project_a, data.project_b])
    result = compare_projects(compare_req, db)

    if len(result["projects"]) < 2:
        raise HTTPException(400, "Need at least 2 valid projects to diff")

    a, b = result["projects"][0], result["projects"][1]

    # Day-by-day comparison
    day_diffs = []
    max_days = max(len(a.get("days", [])), len(b.get("days", [])))

    for i in range(max_days):
        day_a = a["days"][i] if i < len(a.get("days", [])) else None
        day_b = b["days"][i] if i < len(b.get("days", [])) else None

        diff = {"day_number": i + 1}

        if day_a and day_b:
            diff["city"] = {
                "a": day_a.get("city"),
                "b": day_b.get("city"),
                "same": day_a.get("city") == day_b.get("city"),
            }
            diff["hotel"] = {
                "a": day_a.get("hotel"),
                "b": day_b.get("hotel"),
                "same": day_a.get("hotel") == day_b.get("hotel"),
            }
            diff["meal_plan"] = {
                "a": day_a.get("meal_plan"),
                "b": day_b.get("meal_plan"),
                "same": day_a.get("meal_plan") == day_b.get("meal_plan"),
            }
            diff["activities"] = {
                "a": day_a.get("activities", []),
                "b": day_b.get("activities", []),
                "common": list(set(day_a.get("activities", [])) & set(day_b.get("activities", []))),
            }
        elif day_a:
            diff["only_in"] = "a"
            diff["data"] = day_a
        else:
            diff["only_in"] = "b"
            diff["data"] = day_b

        day_diffs.append(diff)

    return {
        "project_a": {"id": a["id"], "name": a["name"]},
        "project_b": {"id": b["id"], "name": b["name"]},
        "day_diffs": day_diffs,
        "summary": {
            "total_days_a": len(a.get("days", [])),
            "total_days_b": len(b.get("days", [])),
            "cities_common": len(result["diff"][0].get("common", [])) if result["diff"] else 0,
        },
    }
