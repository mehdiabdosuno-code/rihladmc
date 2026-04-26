"""Proposal sharing models — public shareable proposal pages."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class ProposalShare(Base, BaseMixin):
    """Shareable link for a project proposal sent to the client."""

    __tablename__ = "proposal_shares"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc) + timedelta(days=30),
    )
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    views: Mapped[int] = mapped_column(Integer, default=0)
    client_name: Mapped[Optional[str]] = mapped_column(String(255))
    client_email: Mapped[Optional[str]] = mapped_column(String(255))

    comments: Mapped[list["ProposalComment"]] = relationship(
        "ProposalComment", back_populates="share", cascade="all, delete-orphan", order_by="ProposalComment.created_at"
    )


class ProposalComment(Base, BaseMixin):
    """Comment left by the client on a shared proposal."""

    __tablename__ = "proposal_comments"

    share_id: Mapped[str] = mapped_column(String(36), ForeignKey("proposal_shares.id", ondelete="CASCADE"), index=True)
    author_name: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    day_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    share: Mapped[ProposalShare] = relationship("ProposalShare", back_populates="comments")
