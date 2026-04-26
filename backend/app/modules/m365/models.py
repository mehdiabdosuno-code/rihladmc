"""M365 integration models — multi-account OAuth + linked emails / files."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class M365Connection(Base, BaseMixin):
    """One row per RIHLA-user × Microsoft-account pair."""

    __tablename__ = "m365_connections"

    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    account_email: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    tenant_id: Mapped[Optional[str]] = mapped_column(String(64))
    scopes: Mapped[Optional[str]] = mapped_column(Text)
    access_token: Mapped[Optional[str]] = mapped_column(Text)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    drive_id: Mapped[Optional[str]] = mapped_column(String(255))
    sharepoint_site_id: Mapped[Optional[str]] = mapped_column(String(255))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSON)

    __table_args__ = (Index("idx_m365_user", "user_id"),)


class M365LinkedMessage(Base, BaseMixin):
    """Cached emails linked to a project / invoice."""

    __tablename__ = "m365_linked_messages"

    connection_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("m365_connections.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    invoice_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    message_id: Mapped[str] = mapped_column(String(255))
    subject: Mapped[Optional[str]] = mapped_column(String(500))
    sender: Mapped[Optional[str]] = mapped_column(String(255))
    recipients: Mapped[Optional[str]] = mapped_column(Text)
    preview: Mapped[Optional[str]] = mapped_column(Text)
    direction: Mapped[str] = mapped_column(String(10), default="in")  # in | out
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
