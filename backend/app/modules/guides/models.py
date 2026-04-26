from typing import Optional, List
from sqlalchemy import String, Float, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.models import Base, BaseMixin

class Guide(Base, BaseMixin):
    """Guide model for inventory management."""
    __tablename__ = "guides"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    languages: Mapped[List[str]] = mapped_column(JSON, default=list)
    specialty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    status: Mapped[str] = mapped_column(String(50), default="Available")
    daily_rate: Mapped[float] = mapped_column(Float, default=0.0)
    seniority: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_certified: Mapped[bool] = mapped_column(Boolean, default=True)
