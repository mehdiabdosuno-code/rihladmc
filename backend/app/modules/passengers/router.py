"""Passengers Management — Traveler list with profiles.

Manages passenger details for confirmed projects:
  - Personal info (name, passport, nationality)
  - Dietary requirements (vegetarian, halal, allergies)
  - Room preferences (single, sharing with)
  - Special needs (mobility, medical)
  - Emergency contacts

Stored in project.pax_profiles JSON field (no extra migration needed).
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.projects.models import Project
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/passengers", tags=["passengers"],
                   dependencies=[Depends(require_auth)])


# ── Schemas ──────────────────────────────────────────────────────────

class Passenger(BaseModel):
    id: Optional[str] = None
    first_name: str
    last_name: str
    gender: Optional[str] = None  # M / F / X
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    passport_expiry: Optional[str] = None
    date_of_birth: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    # Dietary
    dietary: Optional[str] = None  # standard, vegetarian, vegan, halal, kosher, gluten-free
    allergies: Optional[list[str]] = None
    # Room
    room_preference: Optional[str] = None  # single, double, sharing
    sharing_with: Optional[str] = None  # name of roommate
    # Special needs
    mobility_needs: Optional[str] = None
    medical_notes: Optional[str] = None
    # Emergency
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Meta
    is_group_leader: bool = False
    notes: Optional[str] = None


class PassengerList(BaseModel):
    passengers: list[Passenger]


class PassengerStats(BaseModel):
    total: int
    by_gender: dict
    by_nationality: dict
    by_dietary: dict
    singles: int
    doubles: int
    special_needs_count: int
    incomplete_passports: int


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/{project_id}", summary="Get passenger list")
def get_passengers(project_id: str, db: Session = Depends(get_db)):
    """Retrieve the full passenger list for a project."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    passengers = project.pax_profiles or []
    return {
        "project_id": project_id,
        "project_name": project.name,
        "expected_pax": project.pax_count,
        "registered_pax": len(passengers),
        "passengers": passengers,
        "completion_pct": round(len(passengers) / max(project.pax_count or 1, 1) * 100, 1),
    }


@router.put("/{project_id}", summary="Update full passenger list")
def update_passengers(
    project_id: str,
    data: PassengerList,
    db: Session = Depends(get_db),
):
    """Replace the entire passenger list for a project."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    import uuid
    passengers_data = []
    for i, p in enumerate(data.passengers):
        d = p.model_dump()
        if not d.get("id"):
            d["id"] = str(uuid.uuid4())[:8]
        passengers_data.append(d)

    project.pax_profiles = passengers_data
    db.commit()

    return {
        "success": True,
        "project_id": project_id,
        "saved_count": len(passengers_data),
    }


@router.post("/{project_id}/add", summary="Add a single passenger")
def add_passenger(
    project_id: str,
    data: Passenger,
    db: Session = Depends(get_db),
):
    """Add a single passenger to the project."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    import uuid
    passengers = project.pax_profiles or []
    p_dict = data.model_dump()
    p_dict["id"] = str(uuid.uuid4())[:8]
    passengers.append(p_dict)

    project.pax_profiles = passengers
    db.commit()

    return {
        "success": True,
        "passenger_id": p_dict["id"],
        "total_passengers": len(passengers),
    }


@router.delete("/{project_id}/{passenger_id}", summary="Remove a passenger")
def remove_passenger(
    project_id: str,
    passenger_id: str,
    db: Session = Depends(get_db),
):
    """Remove a passenger by ID."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    passengers = project.pax_profiles or []
    original_count = len(passengers)
    passengers = [p for p in passengers if p.get("id") != passenger_id]

    if len(passengers) == original_count:
        raise HTTPException(404, "Passenger not found")

    project.pax_profiles = passengers
    db.commit()

    return {"success": True, "removed_id": passenger_id, "remaining": len(passengers)}


@router.get("/{project_id}/stats", summary="Passenger statistics")
def passenger_stats(project_id: str, db: Session = Depends(get_db)):
    """Get statistics about the passenger list."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    passengers = project.pax_profiles or []

    if not passengers:
        return {
            "project_id": project_id,
            "total": 0,
            "message": "No passengers registered yet",
        }

    by_gender: dict[str, int] = {}
    by_nationality: dict[str, int] = {}
    by_dietary: dict[str, int] = {}
    singles = 0
    special_needs = 0
    incomplete_passports = 0

    for p in passengers:
        g = p.get("gender", "unknown") or "unknown"
        by_gender[g] = by_gender.get(g, 0) + 1

        n = p.get("nationality", "unknown") or "unknown"
        by_nationality[n] = by_nationality.get(n, 0) + 1

        d = p.get("dietary", "standard") or "standard"
        by_dietary[d] = by_dietary.get(d, 0) + 1

        if p.get("room_preference") == "single":
            singles += 1

        if p.get("mobility_needs") or p.get("medical_notes"):
            special_needs += 1

        if not p.get("passport_number"):
            incomplete_passports += 1

    return {
        "project_id": project_id,
        "total": len(passengers),
        "expected_pax": project.pax_count,
        "completion_pct": round(len(passengers) / max(project.pax_count or 1, 1) * 100, 1),
        "by_gender": by_gender,
        "by_nationality": by_nationality,
        "by_dietary": by_dietary,
        "singles_requested": singles,
        "doubles_estimated": (len(passengers) - singles) // 2,
        "special_needs_count": special_needs,
        "incomplete_passports": incomplete_passports,
        "group_leaders": [
            f"{p.get('first_name', '')} {p.get('last_name', '')}"
            for p in passengers if p.get("is_group_leader")
        ],
    }


@router.get("/{project_id}/export-rooming", summary="Export for rooming list")
def export_for_rooming(project_id: str, db: Session = Depends(get_db)):
    """Export passenger data formatted for rooming list generation."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    passengers = project.pax_profiles or []

    formatted = []
    for p in passengers:
        formatted.append({
            "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
            "gender": p.get("gender", ""),
            "room_preference": p.get("room_preference", "double"),
            "sharing_with": p.get("sharing_with", ""),
            "dietary": p.get("dietary", "standard"),
            "allergies": p.get("allergies", []),
            "notes": p.get("notes", ""),
        })

    return {
        "project_id": project_id,
        "total_pax": len(formatted),
        "passengers": formatted,
        "room_summary": {
            "singles": sum(1 for p in formatted if p["room_preference"] == "single"),
            "doubles": sum(1 for p in formatted if p["room_preference"] == "double") // 2,
            "to_allocate": len(formatted),
        },
    }
