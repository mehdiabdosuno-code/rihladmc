"""Quotation Pydantic schemas."""

from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from app.shared.schemas import BaseResponse
from app.modules.quotations.models import QuotationStatus, LineCategory


class QuotationLineCreate(BaseModel):
    day_number: Optional[int] = None
    sort_order: int = 0
    category: LineCategory
    label: str
    city: Optional[str] = None
    supplier: Optional[str] = None
    unit_cost: float = 0
    quantity: float = 1
    unit: Optional[str] = "pax"
    is_included: bool = True
    notes: Optional[str] = None
    meta: Optional[dict] = None


class QuotationLineResponse(BaseResponse):
    quotation_id: str
    day_number: Optional[int]
    sort_order: int
    category: LineCategory
    label: str
    city: Optional[str]
    supplier: Optional[str]
    unit_cost: Decimal
    quantity: Decimal
    unit: Optional[str]
    total_cost: Decimal
    is_included: bool
    notes: Optional[str]
    meta: Optional[dict]


class QuotationCreate(BaseModel):
    project_id: str
    currency: str = "EUR"
    margin_pct: float = Field(default=10.0, ge=0, le=100)
    foc_count: int = Field(default=1, ge=0, le=10)
    notes: Optional[str] = None
    lines: list[QuotationLineCreate] = []


class QuotationUpdate(BaseModel):
    currency: Optional[str] = None
    margin_pct: Optional[float] = Field(default=None, ge=0, le=100)
    foc_count: Optional[int] = Field(default=None, ge=0, le=10)
    notes: Optional[str] = None
    status: Optional[QuotationStatus] = None


class PricingGridEntry(BaseModel):
    basis: int
    foc: int
    price_pax: float
    single_supplement: float
    total_group: float
    margin_per_pax: float


class QuotationResponse(BaseResponse):
    project_id: str
    version: int
    status: QuotationStatus
    currency: str
    margin_pct: Decimal
    foc_count: int = 1
    notes: Optional[str]
    total_cost: Optional[Decimal]
    total_selling: Optional[Decimal]
    price_per_pax: Optional[Decimal]
    single_supplement: Optional[Decimal]
    pricing_grid: Optional[list]
    lines: list[QuotationLineResponse] = []


class QuotationRecalcResponse(BaseModel):
    quotation_id: str
    total_cost: float
    total_selling: float
    price_per_pax: float
    pricing_grid: list[PricingGridEntry]
    breakdown: dict  # category → total
