"""Pydantic schemas for Contracting."""

from datetime import date, datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field

from app.modules.contracting.models import ContractStatus


class ContractRateBase(BaseModel):
    rate_key: str = Field(..., min_length=1, max_length=64)
    pax_min: Optional[int] = None
    pax_max: Optional[int] = None
    unit_price: float
    currency: str = "MAD"
    notes: Optional[str] = None


class ContractRateCreate(ContractRateBase):
    pass


class ContractRateOut(ContractRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    season_id: str


class AllotmentBase(BaseModel):
    rate_key: Optional[str] = None
    quantity: int = 0
    consumed: int = 0
    release_days_before: Optional[int] = None


class AllotmentCreate(AllotmentBase):
    pass


class AllotmentOut(AllotmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    season_id: str
    remaining: int


class ContractSeasonBase(BaseModel):
    name: str
    starts_on: date
    ends_on: date


class ContractSeasonCreate(ContractSeasonBase):
    rates: list[ContractRateCreate] = []
    allotments: list[AllotmentCreate] = []


class ContractSeasonOut(ContractSeasonBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    contract_id: str
    rates: list[ContractRateOut] = []
    allotments: list[AllotmentOut] = []


class ContractBase(BaseModel):
    code: str
    name: str
    supplier_id: str
    article_id: Optional[str] = None
    article_category: Optional[str] = None
    status: ContractStatus = ContractStatus.draft
    valid_from: date
    valid_to: date
    currency: str = "MAD"
    payment_terms_days: Optional[int] = None
    cancellation_policy: Optional[dict[str, Any]] = None
    commission_rate: Optional[float] = None
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    seasons: list[ContractSeasonCreate] = []


class ContractUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ContractStatus] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    payment_terms_days: Optional[int] = None
    cancellation_policy: Optional[dict[str, Any]] = None
    commission_rate: Optional[float] = None
    notes: Optional[str] = None


class ContractOut(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    seasons: list[ContractSeasonOut] = []
    created_at: datetime
    updated_at: datetime


# ── Pricing Engine I/O ─────────────────────────────────────────────

class PriceQuoteRequest(BaseModel):
    article_id: str
    supplier_id: Optional[str] = None
    service_date: date
    rate_key: Optional[str] = None  # e.g. DBL, SGL, ADULT
    pax: Optional[int] = None
    quantity: int = 1


class PriceQuoteResponse(BaseModel):
    article_id: str
    supplier_id: Optional[str] = None
    contract_id: Optional[str] = None
    season_id: Optional[str] = None
    rate_id: Optional[str] = None
    unit_price: float
    currency: str
    quantity: int
    total: float
    source: str  # "contract" | "article_default" | "none"
    warnings: list[str] = []
    allotment_remaining: Optional[int] = None
