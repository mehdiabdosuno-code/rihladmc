from enum import Enum
from typing import Optional
from sqlalchemy import String, Boolean, Date, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.models import Base, BaseMixin


class AvailabilityStatus(str, Enum):
    AVAILABLE  = "available"
    BUSY       = "busy"
    TENTATIVE  = "tentative"


class RemarkType(str, Enum):
    OBSERVATION = "observation"
    ISSUE       = "issue"
    SUGGESTION  = "suggestion"


class GuideAvailability(Base, BaseMixin):
    __tablename__ = "guide_availabilities"

    guide_id:   Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date:       Mapped[str]           = mapped_column(String(10))          # ISO date YYYY-MM-DD
    status:     Mapped[AvailabilityStatus] = mapped_column(String(20), default=AvailabilityStatus.AVAILABLE)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    notes:      Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("idx_guide_avail_date", "guide_id", "date"),)


class CircuitRemark(Base, BaseMixin):
    __tablename__ = "circuit_remarks"

    guide_id:          Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    guide_name:        Mapped[str]           = mapped_column(String(255))
    project_id:        Mapped[str]           = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    itinerary_day_id:  Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    day_number:        Mapped[Optional[int]] = mapped_column(nullable=True)
    remark_type:       Mapped[RemarkType]    = mapped_column(String(20), default=RemarkType.OBSERVATION)
    content:           Mapped[str]           = mapped_column(Text)
    is_resolved:       Mapped[bool]          = mapped_column(Boolean, default=False)

    __table_args__ = (Index("idx_remark_project", "project_id"),)
