"""Gamification module — Tracking staff performance and achievements."""

from sqlalchemy import Column, String, Integer, Float, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.shared.models import Base, BaseMixin

class UserStats(Base, BaseMixin):
    """Tracking performance metrics for Travel Designers, Guides, and Drivers."""
    __tablename__ = "user_stats"

    user_id: Mapped[str] = mapped_column(String(50), index=True, unique=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    
    # Metrics
    dossiers_won: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue_generated: Mapped[float] = mapped_column(Float, default=0.0)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Achievements
    badges: Mapped[Optional[dict]] = mapped_column(JSON, default=list) # List of badge IDs
    
    # Levels progress (experience points)
    xp: Mapped[int] = mapped_column(Integer, default=0)
