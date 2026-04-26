from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.modules.hotels.models import Hotel

router = APIRouter(prefix="/hotels", tags=["Inventory"])

class HotelSchema(BaseModel):
    id: str
    name: str
    city: str
    category: str
    base_rate: float
    single_supplement: float
    currency: str
    season: Optional[str]
    status: str
    image_url: Optional[str]

    class Config:
        from_attributes = True

@router.get("/", response_model=List[HotelSchema])
async def list_hotels(
    city: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = select(Hotel)
    if city:
        query = query.where(Hotel.city == city)
    if category:
        query = query.where(Hotel.category == category)
    
    result = db.execute(query).scalars().all()
    return result

from app.modules.hotels.service import HotelService

@router.get("/{hotel_id}/availability")
async def check_availability(
    hotel_id: str, 
    dates: str = "2026-06-01", 
    pax: int = 2,
    db: Session = Depends(get_db)
):
    service = HotelService(db)
    return await service.check_live_availability(hotel_id, dates, pax)
