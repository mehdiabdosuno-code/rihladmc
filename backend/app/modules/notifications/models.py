from typing import Optional
from sqlalchemy import String, Boolean, Text, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.models import Base, BaseMixin


class Notification(Base, BaseMixin):
    __tablename__ = "notifications"

    recipient_id: Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id:   Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    sender_name:  Mapped[str]           = mapped_column(String(255))
    type:         Mapped[str]           = mapped_column(String(30))   # review, remark, agenda_update, system
    title:        Mapped[str]           = mapped_column(String(255))
    message:      Mapped[str]           = mapped_column(Text)
    is_read:      Mapped[bool]          = mapped_column(Boolean, default=False, index=True)
    extra:        Mapped[Optional[dict]]= mapped_column(JSON, nullable=True)

    __table_args__ = (Index("idx_notif_recipient_unread", "recipient_id", "is_read"),)
