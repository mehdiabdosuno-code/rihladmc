"""Transport router — Full CRUD for transport catalogue.

Endpoints:
    GET    /transports/          — List all (with filters)
    POST   /transports/          — Create transport
    GET    /transports/{id}      — Get by ID
    PUT    /transports/{id}      — Full update
    PATCH  /transports/{id}      — Partial update
    DELETE /transports/{id}      — Soft delete (active=False)
    GET    /transports/search    — Search by city/vehicle type
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.shared.dependencies import require_auth, require_role
from app.modules.transports.models import Transport, VehicleType, TransportType
from app.modules.transports.schemas import TransportCreate, TransportUpdate, TransportOut

router = APIRouter(prefix="/transports", tags=["transports"], dependencies=[Depends(require_auth)])


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[TransportOut], summary="List transports catalogue")
def list_transports(
    vehicle_type: Optional[VehicleType] = Query(None),
    transport_type: Optional[TransportType] = Query(None),
    origin_city: Optional[str] = Query(None),
    destination_city: Optional[str] = Query(None),
    is_luxury: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List transport entries with optional filters."""
    q = select(Transport).where(Transport.active == True)

    if vehicle_type:
        q = q.where(Transport.vehicle_type == vehicle_type)
    if transport_type:
        q = q.where(Transport.transport_type == transport_type)
    if origin_city:
        q = q.where(Transport.origin_city.ilike(f"%{origin_city}%"))
    if destination_city:
        q = q.where(Transport.destination_city.ilike(f"%{destination_city}%"))
    if is_luxury is not None:
        q = q.where(Transport.is_luxury == is_luxury)

    q = q.order_by(Transport.origin_city, Transport.label).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=TransportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create transport entry",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def create_transport(payload: TransportCreate, db: Session = Depends(get_db)):
    """Create a new transport catalogue entry."""
    transport = Transport(**payload.model_dump())
    db.add(transport)
    db.commit()
    db.refresh(transport)
    return transport


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------
@router.get("/{transport_id}", response_model=TransportOut, summary="Get transport by ID")
def get_transport(transport_id: str, db: Session = Depends(get_db)):
    transport = db.get(Transport, transport_id)
    if not transport or not transport.active:
        raise HTTPException(status_code=404, detail=f"Transport '{transport_id}' introuvable.")
    return transport


# ---------------------------------------------------------------------------
# UPDATE (full)
# ---------------------------------------------------------------------------
@router.put(
    "/{transport_id}",
    response_model=TransportOut,
    summary="Full update transport",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def update_transport(transport_id: str, payload: TransportCreate, db: Session = Depends(get_db)):
    transport = db.get(Transport, transport_id)
    if not transport or not transport.active:
        raise HTTPException(status_code=404, detail=f"Transport '{transport_id}' introuvable.")
    for field, value in payload.model_dump().items():
        setattr(transport, field, value)
    db.commit()
    db.refresh(transport)
    return transport


# ---------------------------------------------------------------------------
# PATCH (partial)
# ---------------------------------------------------------------------------
@router.patch(
    "/{transport_id}",
    response_model=TransportOut,
    summary="Partial update transport",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def patch_transport(transport_id: str, payload: TransportUpdate, db: Session = Depends(get_db)):
    transport = db.get(Transport, transport_id)
    if not transport or not transport.active:
        raise HTTPException(status_code=404, detail=f"Transport '{transport_id}' introuvable.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(transport, field, value)
    db.commit()
    db.refresh(transport)
    return transport


# ---------------------------------------------------------------------------
# DELETE (soft)
# ---------------------------------------------------------------------------
@router.delete(
    "/{transport_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete transport",
    dependencies=[Depends(require_role("super_admin", "sales_director"))],
)
def delete_transport(transport_id: str, db: Session = Depends(get_db)):
    transport = db.get(Transport, transport_id)
    if not transport or not transport.active:
        raise HTTPException(status_code=404, detail=f"Transport '{transport_id}' introuvable.")
    transport.active = False
    db.commit()


# ---------------------------------------------------------------------------
# SEARCH (cities or label)
# ---------------------------------------------------------------------------
@router.get("/search/query", response_model=list[TransportOut], summary="Search transports")
def search_transports(
    q: str = Query(..., min_length=2, description="Search in label, origin, destination"),
    db: Session = Depends(get_db),
):
    """Full-text search on label, origin_city, destination_city."""
    results = db.execute(
        select(Transport).where(
            Transport.active == True,
            or_(
                Transport.label.ilike(f"%{q}%"),
                Transport.origin_city.ilike(f"%{q}%"),
                Transport.destination_city.ilike(f"%{q}%"),
                Transport.supplier_name.ilike(f"%{q}%"),
            )
        ).order_by(Transport.label).limit(50)
    ).scalars().all()
    return results
