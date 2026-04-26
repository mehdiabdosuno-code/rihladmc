"""Itinerary templates — reusable circuit blueprints (B1).

A Travel Designer can:
  * save an existing project itinerary as a template
  * browse a library of templates
  * apply a template to a new (or existing) project to seed its itinerary
"""

from typing import Optional
from sqlalchemy import String, Text, Integer, JSON, Index, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class ItineraryTemplate(Base, BaseMixin):
    """A reusable circuit blueprint, scoped to a tenant (company_id)."""

    __tablename__ = "itinerary_templates"

    company_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    destination: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    duration_days: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(10), default="fr")
    hotel_category: Mapped[Optional[str]] = mapped_column(String(20))   # 5★, 4★, riad, mixed
    target_audience: Mapped[Optional[str]] = mapped_column(String(50))  # FIT, family, MICE, luxury, adventure
    tags: Mapped[Optional[list]] = mapped_column(JSON)                  # ["sahara", "imperial", "couples"]
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)     # shareable across tenants
    use_count: Mapped[int] = mapped_column(Integer, default=0)

    days: Mapped[list["ItineraryTemplateDay"]] = relationship(
        "ItineraryTemplateDay",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ItineraryTemplateDay.day_number",
    )

    __table_args__ = (
        Index("idx_itinerary_template_company", "company_id"),
        Index("idx_itinerary_template_destination", "destination"),
    )


class ItineraryTemplateDay(Base, BaseMixin):
    """A single day in a template — mirrors ItineraryDay structure."""

    __tablename__ = "itinerary_template_days"

    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("itinerary_templates.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    subtitle: Mapped[Optional[str]] = mapped_column(String(300))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    hotel: Mapped[Optional[str]] = mapped_column(String(200))
    hotel_category: Mapped[Optional[str]] = mapped_column(String(20))
    meal_plan: Mapped[Optional[str]] = mapped_column(String(20))
    travel_time: Mapped[Optional[str]] = mapped_column(String(100))
    distance_km: Mapped[Optional[int]] = mapped_column(Integer)
    activities: Mapped[Optional[list]] = mapped_column(JSON)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    image_url_2: Mapped[Optional[str]] = mapped_column(String(500))

    template: Mapped["ItineraryTemplate"] = relationship("ItineraryTemplate", back_populates="days")

    __table_args__ = (Index("idx_itinerary_template_day_template", "template_id"),)
