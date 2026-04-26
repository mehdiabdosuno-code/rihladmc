"""Rooming List & Logistics — Auto-generate operational documents for confirmed circuits.

For confirmed groups, generates:
  - Rooming list (room allocation: single/double/triple/twin)
  - Guide logistics sheet (contacts, schedules, hotel confirmations)
  - Driver route sheet (GPS waypoints, stops, km)
  - Excel export of all documents

Endpoints:
  POST /rooming/generate/{project_id}     — Generate rooming list from pax data
  GET  /rooming/{project_id}              — Get existing rooming list
  POST /rooming/logistics/{project_id}    — Generate guide logistics sheet
  POST /rooming/driver-sheet/{project_id} — Generate driver route sheet
  POST /rooming/export/{project_id}       — Export all as structured JSON
"""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.shared.dependencies import require_auth

router = APIRouter(
    prefix="/rooming",
    tags=["rooming-list"],
    dependencies=[Depends(require_auth)],
)


# ── Schemas ───────────────────────────────────────────────────────────

class Passenger(BaseModel):
    """Individual passenger information."""
    name: str
    passport_number: Optional[str] = None
    nationality: Optional[str] = None
    room_preference: str = "double"  # single | double | twin | triple
    dietary: Optional[str] = None
    notes: Optional[str] = None


class RoomingRequest(BaseModel):
    """Request to generate rooming list."""
    passengers: list[Passenger] = []
    total_pax: int = 20
    room_config: dict = Field(default={
        "single_pct": 10,   # 10% singles
        "double_pct": 80,   # 80% doubles
        "triple_pct": 10,   # 10% triples
    })
    foc_count: int = 1  # Free of charge (guide/leader)


class RoomAllocation(BaseModel):
    room_number: int
    room_type: str
    guests: list[str]
    hotel: str
    night: int
    notes: Optional[str] = None


class LogisticsEntry(BaseModel):
    day_number: int
    date: Optional[str] = None
    city: str
    hotel: Optional[str] = None
    hotel_phone: Optional[str] = None
    hotel_confirmation: Optional[str] = None
    meal_plan: Optional[str] = None
    activities: list[str] = []
    guide_notes: Optional[str] = None
    emergency_contact: Optional[str] = None


class RoutePoint(BaseModel):
    day_number: int
    from_city: Optional[str] = None
    to_city: str
    distance_km: int = 0
    travel_time: Optional[str] = None
    waypoints: list[str] = []
    fuel_stop: bool = False
    notes: Optional[str] = None


# ── Room allocation algorithm ────────────────────────────────────────

def _allocate_rooms(
    total_pax: int,
    config: dict,
    passengers: list[Passenger],
    foc: int = 1,
) -> list[dict]:
    """Allocate rooms based on pax count and configuration."""
    paying_pax = total_pax - foc
    single_pct = config.get("single_pct", 10) / 100
    triple_pct = config.get("triple_pct", 10) / 100

    num_singles = max(1, round(paying_pax * single_pct))
    num_triples = max(0, round(paying_pax * triple_pct))
    remaining = paying_pax - num_singles - (num_triples * 3)
    num_doubles = max(0, math.ceil(remaining / 2))

    # FOC room (guide/leader)
    num_singles += foc

    rooms = []
    room_num = 1
    pax_idx = 0

    def get_guest_name(idx):
        if idx < len(passengers):
            return passengers[idx].name
        return f"Passager {idx + 1}"

    # Singles
    for _ in range(num_singles):
        name = get_guest_name(pax_idx)
        is_foc = pax_idx >= paying_pax
        rooms.append({
            "room_number": room_num,
            "room_type": "single",
            "guests": [name],
            "occupancy": 1,
            "notes": "FOC — Guide/Chef de groupe" if is_foc else None,
        })
        room_num += 1
        pax_idx += 1

    # Doubles
    for _ in range(num_doubles):
        guests = []
        for _ in range(2):
            if pax_idx < total_pax:
                guests.append(get_guest_name(pax_idx))
                pax_idx += 1
        rooms.append({
            "room_number": room_num,
            "room_type": "double",
            "guests": guests,
            "occupancy": len(guests),
            "notes": None,
        })
        room_num += 1

    # Triples
    for _ in range(num_triples):
        guests = []
        for _ in range(3):
            if pax_idx < total_pax:
                guests.append(get_guest_name(pax_idx))
                pax_idx += 1
        rooms.append({
            "room_number": room_num,
            "room_type": "triple",
            "guests": guests,
            "occupancy": len(guests),
            "notes": None,
        })
        room_num += 1

    return rooms


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/generate/{project_id}", summary="Generate rooming list")
def generate_rooming(
    project_id: str,
    data: RoomingRequest,
    db: Session = Depends(get_db),
):
    """Generate rooming list with room allocation for each night."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()

    days = []
    if itin:
        days = db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.itinerary_id == itin.id)
            .order_by(ItineraryDay.day_number)
        ).scalars().all()

    # Allocate rooms
    rooms = _allocate_rooms(
        data.total_pax,
        data.room_config,
        data.passengers,
        data.foc_count,
    )

    # Build per-night rooming
    nightly_rooming = []
    for d in days:
        if not d.hotel:
            continue

        night_rooms = []
        for room in rooms:
            night_rooms.append({
                **room,
                "hotel": d.hotel or "",
                "night": d.day_number,
                "city": d.city or "",
            })

        nightly_rooming.append({
            "night": d.day_number,
            "city": d.city,
            "hotel": d.hotel,
            "hotel_category": d.hotel_category,
            "rooms": night_rooms,
        })

    # Summary stats
    room_summary = {
        "total_rooms": len(rooms),
        "singles": sum(1 for r in rooms if r["room_type"] == "single"),
        "doubles": sum(1 for r in rooms if r["room_type"] == "double"),
        "triples": sum(1 for r in rooms if r["room_type"] == "triple"),
        "total_pax": data.total_pax,
        "foc": data.foc_count,
        "paying_pax": data.total_pax - data.foc_count,
        "nights": len(nightly_rooming),
    }

    return {
        "project_id": project_id,
        "project_name": project.name,
        "client_name": project.client_name,
        "room_summary": room_summary,
        "room_allocation": rooms,
        "nightly_rooming": nightly_rooming,
    }


@router.post("/logistics/{project_id}", summary="Generate guide logistics sheet")
def generate_logistics(project_id: str, db: Session = Depends(get_db)):
    """Generate the complete logistics sheet for the guide."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()
    if not itin:
        raise HTTPException(404, "No itinerary found")

    days = db.execute(
        select(ItineraryDay)
        .where(ItineraryDay.itinerary_id == itin.id)
        .order_by(ItineraryDay.day_number)
    ).scalars().all()

    logistics = []
    for d in days:
        logistics.append(LogisticsEntry(
            day_number=d.day_number,
            city=d.city or "",
            hotel=d.hotel,
            hotel_phone="À compléter",
            hotel_confirmation="À compléter",
            meal_plan=d.meal_plan,
            activities=d.activities or [],
            guide_notes=d.description,
            emergency_contact="S'TOURS: +212 5 22 XX XX XX",
        ))

    return {
        "project_id": project_id,
        "project_name": project.name,
        "client": project.client_name,
        "duration": f"{project.duration_days}J/{project.duration_nights}N",
        "travel_dates": project.travel_dates,
        "guide_info": {
            "name": "À assigner",
            "phone": "À compléter",
            "languages": ["Français", "Anglais", "Arabe"],
        },
        "emergency": {
            "company": "S'TOURS DMC Morocco",
            "phone": "+212 5 22 XX XX XX",
            "email": "ops@stours.ma",
        },
        "logistics": [l.model_dump() for l in logistics],
    }


@router.post("/driver-sheet/{project_id}", summary="Generate driver route sheet")
def generate_driver_sheet(project_id: str, db: Session = Depends(get_db)):
    """Generate the driver's route sheet with distances and waypoints."""
    from app.modules.ai.travel_designer import _get_distance

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()
    if not itin:
        raise HTTPException(404, "No itinerary found")

    days = db.execute(
        select(ItineraryDay)
        .where(ItineraryDay.itinerary_id == itin.id)
        .order_by(ItineraryDay.day_number)
    ).scalars().all()

    route_points = []
    total_km = 0
    prev_city = None

    for d in days:
        distance = d.distance_km or 0
        travel_time = d.travel_time or ""

        if prev_city and d.city and prev_city != d.city:
            dist, tt = _get_distance(prev_city, d.city)
            if dist > 0:
                distance = dist
                travel_time = tt

        total_km += distance

        route_points.append(RoutePoint(
            day_number=d.day_number,
            from_city=prev_city,
            to_city=d.city or "",
            distance_km=distance,
            travel_time=travel_time,
            waypoints=d.activities or [],
            fuel_stop=distance > 200,
            notes=f"Hôtel: {d.hotel}" if d.hotel else None,
        ))

        if d.city:
            prev_city = d.city

    return {
        "project_id": project_id,
        "project_name": project.name,
        "total_km": total_km,
        "total_days": len(days),
        "vehicle": {
            "type": "À confirmer",
            "capacity": "À confirmer",
            "driver_name": "À assigner",
            "driver_phone": "À compléter",
        },
        "route": [r.model_dump() for r in route_points],
        "fuel_stops_recommended": sum(1 for r in route_points if r.fuel_stop),
    }
