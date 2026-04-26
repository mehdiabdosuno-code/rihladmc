"""Travel Companion — schemas."""

from datetime import datetime, date
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


# ── Agency-side: create / list / revoke links ─────────────────────

class TravelLinkCreate(BaseModel):
    project_id: str
    expires_at: Optional[datetime] = None
    pin: Optional[str] = None
    locale: str = "fr"


class TravelLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    project_id: str
    token: str
    pin: Optional[str] = None
    expires_at: Optional[datetime] = None
    revoked: bool
    last_seen_at: Optional[datetime] = None
    open_count: int
    locale: str
    created_at: datetime


class TravelLinkPublic(BaseModel):
    """Token-as-URL form returned to the agency for sharing."""
    token: str
    url: str
    pin: Optional[str] = None
    expires_at: Optional[datetime] = None


# ── Client-side (no auth): trip program ───────────────────────────

class TripDay(BaseModel):
    day_number: int
    date: Optional[date] = None
    title: str
    subtitle: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    hotel: Optional[str] = None
    hotel_category: Optional[str] = None
    meal_plan: Optional[str] = None
    travel_time: Optional[str] = None
    distance_km: Optional[int] = None
    activities: Optional[list[str]] = None
    image_url: Optional[str] = None


class TripContact(BaseModel):
    label: str        # "Chauffeur", "Guide", "Hotline 24/7", ...
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None


class TripBranding(BaseModel):
    company_name: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    welcome_message: Optional[str] = None


class TripPublicView(BaseModel):
    project_id: str
    title: str
    client_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    branding: TripBranding
    days: list[TripDay] = Field(default_factory=list)
    contacts: list[TripContact] = Field(default_factory=list)
    notices: list[str] = Field(default_factory=list)


# ── Client-side: send a message back ──────────────────────────────

class TravelMessageCreate(BaseModel):
    kind: str = "message"
    body: str = Field(..., min_length=2, max_length=4000)


class TravelMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    kind: str
    body: str
    handled: bool
    created_at: datetime
