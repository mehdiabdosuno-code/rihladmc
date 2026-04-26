from enum import Enum
from typing import Optional
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.models import Base, BaseMixin


class ReviewTarget(str, Enum):
    GUIDE = "guide"
    DRIVER = "driver"
    RESTAURANT = "restaurant"
    HOTEL = "hotel"


class Review(Base, BaseMixin):
    __tablename__ = "reviews"

    project_id:   Mapped[str]           = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    reviewer_id:  Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reviewer_name:Mapped[str]           = mapped_column(String(255))
    target_type:  Mapped[ReviewTarget]  = mapped_column(String(20))
    target_id:    Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    target_name:  Mapped[str]           = mapped_column(String(255))
    rating:       Mapped[int]           = mapped_column(Integer)          # 1-5
    comment:      Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public:    Mapped[bool]          = mapped_column(Boolean, default=True)

    __table_args__ = (
        Index("idx_review_project", "project_id"),
        Index("idx_review_target", "target_type", "target_id"),
    )
