"""Sub-agent B2B Portal — schemas (no DB models, reuses Partner/Project)."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PortalBranding(BaseModel):
    """Customisations the sub-agent's clients see."""
    company_name: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    welcome_message: Optional[str] = None
    hide_costs: bool = True


class PortalIdentity(BaseModel):
    """What the logged-in sub-agent user looks like."""
    user_id: str
    email: str
    full_name: Optional[str] = None
    partner_id: str
    partner_name: str
    branding: PortalBranding
    company_id: str


class PortalProject(BaseModel):
    """Project as visible to a sub-agent — costs / margins stripped out."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    reference: Optional[str] = None
    client_name: Optional[str] = None
    destination: Optional[str] = None
    pax_count: Optional[int] = None
    duration_days: Optional[int] = None
    travel_dates: Optional[str] = None
    status: str
    created_at: datetime


class PortalCatalogItem(BaseModel):
    """A pre-built circuit / package the sub-agent can resell."""
    id: str
    name: str
    destination: Optional[str] = None
    duration_days: Optional[int] = None
    pax_count: Optional[int] = None
    cover_image_url: Optional[str] = None
    highlights: list[str] = Field(default_factory=list)
    sell_price_from: Optional[float] = None
    currency: str = "EUR"


class PortalQuoteRequest(BaseModel):
    """Sub-agent submits a quote request on behalf of their client."""
    client_name: str = Field(..., min_length=2, max_length=200)
    client_email: Optional[str] = None
    client_country: Optional[str] = None
    pax_count: int = Field(..., ge=1, le=200)
    travel_dates: Optional[str] = None
    duration_days: Optional[int] = None
    destination: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)
    catalog_item_id: Optional[str] = None
