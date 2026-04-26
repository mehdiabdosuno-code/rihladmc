"""Hotel Inventory Service — Managing contracts and live availability sync."""

import random
import asyncio
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.hotels.models import Hotel

class HotelService:
    def __init__(self, db: Session):
        self.db = db

    async def check_live_availability(self, hotel_id: str, dates: str, pax: int) -> Dict:
        """
        Simulates a live API call to a hotel provider (e.g., Amadeus, Booking, or custom CRS).
        In production, this would use a real provider's SDK or REST API.
        """
        hotel = self.db.get(Hotel, hotel_id)
        if not hotel:
            return {"error": "Hotel not found"}

        # Simulate network latency
        await asyncio.sleep(1.2)

        # Mock logic: availability depends on "pax" and "randomness"
        # We simulate that some dates are peak/full
        is_available = random.random() > 0.15 # 85% availability for the demo
        
        return {
            "hotel_id": hotel_id,
            "hotel_name": hotel.name,
            "status": "available" if is_available else "sold_out",
            "provider": "S'TOURS Direct Connect",
            "last_updated": "Just now",
            "rooms": [
                {"type": "Standard Double", "available": 4, "price_diff": 0},
                {"type": "Junior Suite", "available": 2, "price_diff": 450},
                {"type": "Presidential Suite", "available": 1, "price_diff": 1200}
            ] if is_available else []
        }

    def list_hotels(self, city: Optional[str] = None) -> List[Hotel]:
        query = select(Hotel)
        if city:
            query = query.where(Hotel.city == city)
        return self.db.execute(query).scalars().all()
