"""Procure-to-Pay module models — SAP/Ariba-inspired.

Cycle complet : PR (demande d'achat) → PO (bon de commande) → Receipt
(réception fournisseur) → SupplierInvoice (facture fournisseur) → P2PMatch
(rapprochement 3-way).
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, ForeignKey, JSON, Float, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.models import BaseMixin


class PRCategory(str, Enum):
    HOTEL = "hotel"
    TRANSPORT = "transport"
    RESTAURANT = "restaurant"
    ACTIVITY = "activity"
    GUIDE = "guide"
    OTHER = "other"


class PRStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    SOURCED = "sourced"     # PO has been issued
    CANCELLED = "cancelled"


class POStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class SupplierInvoiceStatus(str, Enum):
    RECEIVED = "received"
    MATCHED = "matched"
    PAID = "paid"
    DISPUTED = "disputed"


class MatchStatus(str, Enum):
    UNMATCHED = "unmatched"      # only PO present
    PARTIAL = "partial"          # PO + receipt OR PO + invoice
    MATCHED = "matched"          # PO + receipt + invoice all aligned
    DISCREPANCY = "discrepancy"  # all 3 present but amounts/qty differ


class PurchaseRequisition(Base, BaseMixin):
    __tablename__ = "p2p_purchase_requisitions"

    reference: Mapped[str] = mapped_column(String(32), index=True, unique=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(20), default=PRCategory.OTHER.value)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    supplier_partner_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    supplier_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    qty: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(32), default="unit")
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    needed_by: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=PRStatus.DRAFT.value, index=True)
    requested_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class PurchaseOrder(Base, BaseMixin):
    __tablename__ = "p2p_purchase_orders"

    reference: Mapped[str] = mapped_column(String(32), index=True, unique=True)
    requisition_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    supplier_partner_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    supplier_name: Mapped[str] = mapped_column(String(255))
    supplier_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    issue_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    expected_delivery: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    payment_terms: Mapped[str] = mapped_column(String(64), default="net_30")
    status: Mapped[str] = mapped_column(String(24), default=POStatus.DRAFT.value, index=True)
    notes: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class GoodsReceipt(Base, BaseMixin):
    __tablename__ = "p2p_goods_receipts"

    po_id: Mapped[str] = mapped_column(String(36), index=True)
    receipt_date: Mapped[str] = mapped_column(String(20))
    qty_received: Mapped[float] = mapped_column(Float, default=0.0)
    amount_received: Mapped[float] = mapped_column(Float, default=0.0)
    is_complete: Mapped[bool] = mapped_column(default=False)
    received_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)


class SupplierInvoice(Base, BaseMixin):
    __tablename__ = "p2p_supplier_invoices"

    po_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    supplier_name: Mapped[str] = mapped_column(String(255))
    number: Mapped[str] = mapped_column(String(64), index=True)
    issue_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    status: Mapped[str] = mapped_column(String(20), default=SupplierInvoiceStatus.RECEIVED.value, index=True)
    notes: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
