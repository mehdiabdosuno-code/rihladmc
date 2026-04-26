"""Quotation models — Deterministic pricing engine."""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Integer, Numeric, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class QuotationStatus(str, Enum):
    DRAFT = "draft"
    CALCULATED = "calculated"
    APPROVED = "approved"
    EXPORTED = "exported"


class Quotation(Base, BaseMixin):
    """Master quotation — one per project version."""

    __tablename__ = "quotations"

    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[QuotationStatus] = mapped_column(String(50), default=QuotationStatus.DRAFT)
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    margin_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Computed totals (updated on recalc)
    total_cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    total_selling: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    price_per_pax: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    single_supplement: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))

    # FOC (Free Of Charge) — tour leader rooms
    foc_count: Mapped[int] = mapped_column(Integer, default=1)

    # Pricing grid by pax basis (JSON: [{basis:10, foc:1, price_pax:X, ss:Y},...])
    pricing_grid: Mapped[Optional[dict]] = mapped_column(JSON)

    project: Mapped["Project"] = relationship("Project", back_populates="quotations")
    lines: Mapped[list["QuotationLine"]] = relationship(
        "QuotationLine", back_populates="quotation", cascade="all, delete-orphan",
        order_by="QuotationLine.day_number, QuotationLine.sort_order"
    )

    __table_args__ = (Index("idx_quotation_project", "project_id"),)


class LineCategory(str, Enum):
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    MONUMENT = "monument"
    TRANSPORT = "transport"
    GUIDE = "guide"
    ACTIVITY = "activity"
    MISC = "misc"


class QuotationLine(Base, BaseMixin):
    """Single cost line in a quotation."""

    __tablename__ = "quotation_lines"

    quotation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[Optional[int]] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[LineCategory] = mapped_column(String(50), index=True)
    label: Mapped[str] = mapped_column(String(300))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    supplier: Mapped[Optional[str]] = mapped_column(String(200))
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(50))  # pax, room, group, day
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    is_included: Mapped[bool] = mapped_column(default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSON)  # regime, category stars, etc.

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="lines")

    __table_args__ = (Index("idx_qline_quotation", "quotation_id"),)
