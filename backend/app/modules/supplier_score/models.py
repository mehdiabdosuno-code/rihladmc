"""Supplier Performance Score — models.

Two new tables:
- supplier_incidents: lightweight, agency-declared incidents tied to a supplier
- supplier_score_snapshots: historical record of computed scores (for trends)

We do NOT alter the existing Partner table here. Two soft fields are read by
the service from the JSON `commercial_terms` blob on Partner if present:
  responsiveness_score (0-15) and tariff_compliance_score (0-15).
Defaults apply when missing.
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    String, ForeignKey, DateTime, Date, Integer, Numeric, Text, Index,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class SupplierIncident(Base, BaseMixin):
    __tablename__ = "supplier_incidents"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    partner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="CASCADE"), index=True,
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"),
    )
    severity: Mapped[str] = mapped_column(String(20), default="medium")     # low|medium|high|critical
    kind: Mapped[str] = mapped_column(String(40), default="other")          # late|cancelled|quality|tariff|other
    description: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_supplier_incident_partner", "partner_id"),
        Index("idx_supplier_incident_company", "company_id"),
    )


class SupplierScoreSnapshot(Base, BaseMixin):
    """Historical record of a partner's score on a given day."""

    __tablename__ = "supplier_score_snapshots"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    partner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="CASCADE"), index=True,
    )
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    total_score: Mapped[int] = mapped_column(Integer)
    review_score: Mapped[int] = mapped_column(Integer)
    incident_score: Mapped[int] = mapped_column(Integer)
    tariff_score: Mapped[int] = mapped_column(Integer)
    responsiveness_score: Mapped[int] = mapped_column(Integer)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    review_avg: Mapped[Numeric] = mapped_column(Numeric(4, 2), default=0)
    incident_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("idx_score_partner_date", "partner_id", "snapshot_date"),
    )
