"""Invoice schemas — Pydantic v2."""

from typing import Optional, Any
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field
from app.shared.schemas import BaseResponse
from app.modules.invoices.models import InvoiceStatus


class InvoiceLineItem(BaseModel):
    label:      str
    category:   Optional[str] = None   # hotel, transport, guide…
    qty:        float = 1
    unit:       Optional[str] = "pax"
    unit_price: float = 0
    total:      float = 0


class InvoiceCreate(BaseModel):
    project_id:     str
    quotation_id:   Optional[str] = None
    template_id:    Optional[str] = None
    client_name:    Optional[str] = None
    client_email:   Optional[str] = None
    client_address: Optional[str] = None
    issue_date:     Optional[str] = None   # ISO date string
    due_date:       Optional[str] = None
    travel_dates:   Optional[str] = None
    currency:       str = "EUR"
    subtotal:       float = 0
    tax_rate:       float = Field(default=0, ge=0, le=100)
    deposit_pct:    float = Field(default=30, ge=0, le=100)
    pax_count:      Optional[int] = None
    price_per_pax:  Optional[float] = None
    notes:          Optional[str] = None
    payment_terms:  Optional[str] = None
    lines:          list[InvoiceLineItem] = []


class InvoiceUpdate(BaseModel):
    status:         Optional[InvoiceStatus] = None
    client_name:    Optional[str] = None
    client_email:   Optional[str] = None
    client_address: Optional[str] = None
    due_date:       Optional[str] = None
    tax_rate:       Optional[float] = None
    deposit_pct:    Optional[float] = None
    notes:          Optional[str] = None
    payment_terms:  Optional[str] = None
    lines:          Optional[list[InvoiceLineItem]] = None


class InvoiceResponse(BaseResponse):
    number:         str
    project_id:     str
    quotation_id:   Optional[str]
    client_name:    Optional[str]
    client_email:   Optional[str]
    client_address: Optional[str]
    issue_date:     Optional[str]
    due_date:       Optional[str]
    travel_dates:   Optional[str]
    currency:       str
    subtotal:       Decimal
    tax_rate:       Decimal
    tax_amount:     Decimal
    total:          Decimal
    deposit_pct:    Decimal
    deposit_amount: Decimal
    balance_due:    Decimal
    pax_count:      Optional[int]
    price_per_pax:  Optional[Decimal]
    status:         InvoiceStatus
    pdf_generated:  bool
    pdf_path:       Optional[str]
    notes:          Optional[str]
    payment_terms:  Optional[str]
    lines:          Optional[list]


class InvoiceSummary(BaseModel):
    id:            str
    number:        str
    project_id:    str
    client_name:   Optional[str]
    status:        InvoiceStatus
    total:         Decimal
    currency:      str
    issue_date:    Optional[str]
    pdf_generated: bool
    created_at:    Any

    class Config:
        from_attributes = True
