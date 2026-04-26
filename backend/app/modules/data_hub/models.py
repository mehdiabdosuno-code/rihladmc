"""Data Hub — unified search index for cross-module semantic queries."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class HubDocument(Base, BaseMixin):
    """A flattened document indexed from any module (project, quotation, invoice, PR, PO,
    itinerary, media asset, supplier, …) for unified search."""

    __tablename__ = "data_hub_documents"

    source_module: Mapped[str] = mapped_column(String(40), index=True)
    source_id:     Mapped[str] = mapped_column(String(40), index=True)
    title:         Mapped[str] = mapped_column(String(400))
    body:          Mapped[str] = mapped_column(Text)
    tokens:        Mapped[int] = mapped_column(Integer, default=0)

    # facets / meta for filtering & ranking
    project_id:    Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    client_name:   Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    destination:   Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    amount:        Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency:      Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status:        Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    occurred_at:   Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    payload:       Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
