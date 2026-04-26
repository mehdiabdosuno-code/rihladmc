"""Transport module schemas — Pydantic request/response models."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class VehicleType(str, Enum):
    MINIBUS = "minibus"
    COACH = "coach"
    GRAND_COACH = "grand_coach"
    SEDAN = "sedan"
    VAN = "van"
    MINIVAN = "minivan"
    SUV = "suv"
    LUXURY = "luxury"
    HELICOPTER = "helicopter"
    OTHER = "other"


class TransportType(str, Enum):
    TRANSFER = "transfer"
    EXCURSION = "excursion"
    CIRCUIT = "circuit"
    HALF_DAY = "half_day"


class TransportCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=300)
    vehicle_type: VehicleType
    transport_type: TransportType
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    distance_km: Optional[float] = None
    duration_hours: Optional[float] = None
    capacity: int = Field(..., ge=1, le=200)
    min_pax: int = Field(1, ge=1)
    max_pax: int = Field(1, ge=1)
    unit_cost: float = Field(..., ge=0)
    currency: str = Field("MAD", max_length=10)
    unit: str = Field("vehicle", max_length=50)
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    is_air_conditioned: bool = True
    is_luxury: bool = False
    notes: Optional[str] = None


class TransportUpdate(BaseModel):
    label: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    transport_type: Optional[TransportType] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    distance_km: Optional[float] = None
    duration_hours: Optional[float] = None
    capacity: Optional[int] = None
    min_pax: Optional[int] = None
    max_pax: Optional[int] = None
    unit_cost: Optional[float] = None
    currency: Optional[str] = None
    unit: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    is_air_conditioned: Optional[bool] = None
    is_luxury: Optional[bool] = None
    notes: Optional[str] = None


class TransportOut(BaseModel):
    id: str
    label: str
    vehicle_type: VehicleType
    transport_type: TransportType
    origin_city: Optional[str]
    destination_city: Optional[str]
    distance_km: Optional[float]
    duration_hours: Optional[float]
    capacity: int
    min_pax: int
    max_pax: int
    unit_cost: float
    currency: str
    unit: str
    supplier_name: Optional[str]
    supplier_contact: Optional[str]
    is_air_conditioned: bool
    is_luxury: bool
    notes: Optional[str]
    active: bool

    class Config:
        from_attributes = True
