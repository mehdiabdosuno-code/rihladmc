"""Pydantic schemas for Master Data."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, Field

from app.modules.master_data.models import ArticleCategory, PartnerType


# ── Partner ────────────────────────────────────────────────────────

class PartnerBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    type: PartnerType
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict[str, Any]] = None
    tax_id: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_swift: Optional[str] = None
    currency: str = "MAD"
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[PartnerType] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict[str, Any]] = None
    tax_id: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_swift: Optional[str] = None
    currency: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    is_active: Optional[bool] = None


class PartnerOut(PartnerBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    is_active: bool
    legacy_table: Optional[str]
    legacy_id: Optional[str]
    created_at: datetime
    updated_at: datetime


# ── Article ────────────────────────────────────────────────────────

class ArticleBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=255)
    category: ArticleCategory
    unit: str = "unit"
    purchase_price: Optional[float] = None
    sell_price: Optional[float] = None
    currency: str = "MAD"
    vat_rate: Optional[float] = None
    default_supplier_id: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ArticleCategory] = None
    unit: Optional[str] = None
    purchase_price: Optional[float] = None
    sell_price: Optional[float] = None
    currency: Optional[str] = None
    vat_rate: Optional[float] = None
    default_supplier_id: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class ArticleOut(ArticleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    is_active: bool
    legacy_table: Optional[str]
    legacy_id: Optional[str]
    created_at: datetime
    updated_at: datetime
