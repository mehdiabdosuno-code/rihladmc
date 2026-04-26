"""Transport module models — Vehicle fleet and route management.

Manages the transport catalogue used by the quotation pricing engine.
Each transport entry represents a vehicle type with pricing rules.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Numeric, Integer, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class VehicleType(str, Enum):
    MINIBUS = "minibus"           # 8-16 pax
    COACH = "coach"               # 30-50 pax
    GRAND_COACH = "grand_coach"   # 50+ pax
    SEDAN = "sedan"               # 1-3 pax
    VAN = "van"                   # 4-8 pax
    MINIVAN = "minivan"           # 6-10 pax
    SUV = "suv"                   # 4-7 pax
    LUXURY = "luxury"             # Premium sedan/SUV
    HELICOPTER = "helicopter"
    OTHER = "other"


class TransportType(str, Enum):
    TRANSFER = "transfer"         # Point A → Point B
    EXCURSION = "excursion"       # Day trip
    CIRCUIT = "circuit"           # Multi-day tour
    HALF_DAY = "half_day"         # Half-day


class Transport(Base, BaseMixin):
    """Transport catalogue entry — a vehicle type with pricing for a route or service."""

    __tablename__ = "transports"

    # Identity
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    vehicle_type: Mapped[VehicleType] = mapped_column(String(50), nullable=False, index=True)
    transport_type: Mapped[TransportType] = mapped_column(String(50), nullable=False, index=True)

    # Route
    origin_city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    destination_city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(8, 1))
    duration_hours: Mapped[Optional[float]] = mapped_column(Numeric(5, 1))

    # Capacity
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    min_pax: Mapped[int] = mapped_column(Integer, default=1)
    max_pax: Mapped[int] = mapped_column(Integer, default=1)

    # Pricing
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")
    unit: Mapped[str] = mapped_column(String(50), default="vehicle")  # vehicle | pax | day

    # Supplier info
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200))
    supplier_contact: Mapped[Optional[str]] = mapped_column(String(200))

    # Flags
    is_air_conditioned: Mapped[bool] = mapped_column(Boolean, default=True)
    is_luxury: Mapped[bool] = mapped_column(Boolean, default=False)

    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        Index("idx_transport_cities", "origin_city", "destination_city"),
        Index("idx_transport_vehicle", "vehicle_type"),
        Index("idx_transport_type", "transport_type"),
    )
