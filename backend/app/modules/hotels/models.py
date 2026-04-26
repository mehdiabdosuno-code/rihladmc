from typing import Optional
from sqlalchemy import String, Numeric, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin

class Hotel(Base, BaseMixin):
    """Hotel model for inventory management."""
    __tablename__ = "hotels"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # 5*, Luxe, Palace
    
    # Pricing
    base_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    single_supplement: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    
    # Metadata
    season: Mapped[Optional[str]] = mapped_column(String(50)) # High, Low, Peak
    status: Mapped[str] = mapped_column(String(50), default="Active")
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Contact
    contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))

    __table_args__ = (
        Index("idx_hotel_city", "city"),
        Index("idx_hotel_category", "category"),
    )
