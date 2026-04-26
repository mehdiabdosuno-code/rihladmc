"""Payment Reminder model — Agent Acompte (#1a)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class PaymentReminder(Base, BaseMixin):
    __tablename__ = "payment_reminders"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    level: Mapped[int] = mapped_column(Integer, default=0)  # 0=initial, 1=J+3, 2=J+7, 3=J+10, 4=escalated
    kind: Mapped[str] = mapped_column(String(20), default="email")  # email | sms | escalation
    subject: Mapped[Optional[str]] = mapped_column(String(300))
    body_preview: Mapped[Optional[str]] = mapped_column(Text)
    recipient: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="sent")  # sent | failed | pending
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
