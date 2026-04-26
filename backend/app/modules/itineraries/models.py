"""Itinerary models — Day-by-day program structure."""

from typing import Optional
from sqlalchemy import String, Text, Integer, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class Itinerary(Base, BaseMixin):
    """Day program collection for a project."""

    __tablename__ = "itineraries"

    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    language: Mapped[str] = mapped_column(String(10), default="fr")

    project: Mapped["Project"] = relationship("Project", back_populates="itineraries")
    days: Mapped[list["ItineraryDay"]] = relationship(
        "ItineraryDay", back_populates="itinerary",
        cascade="all, delete-orphan",
        order_by="ItineraryDay.day_number"
    )

    __table_args__ = (Index("idx_itinerary_project", "project_id"),)


class ItineraryDay(Base, BaseMixin):
    """Single day in an itinerary."""

    __tablename__ = "itinerary_days"

    itinerary_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("itineraries.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    subtitle: Mapped[Optional[str]] = mapped_column(String(300))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    hotel: Mapped[Optional[str]] = mapped_column(String(200))
    hotel_category: Mapped[Optional[str]] = mapped_column(String(20))  # 5★, 4★, riad
    meal_plan: Mapped[Optional[str]] = mapped_column(String(20))  # HB, BB, FB
    travel_time: Mapped[Optional[str]] = mapped_column(String(100))
    distance_km: Mapped[Optional[int]] = mapped_column(Integer)
    activities: Mapped[Optional[dict]] = mapped_column(JSON)  # list of strings or [{label, entry_status, fee_pax}]
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    image_url_2: Mapped[Optional[str]] = mapped_column(String(500))
    ai_generated: Mapped[bool] = mapped_column(default=False)

    # Travel Designer enrichments (S'TOURS parity)
    room_type: Mapped[Optional[str]] = mapped_column(String(50))  # Standard, Deluxe, Suite, Riad
    city_tax_per_night: Mapped[Optional[float]] = mapped_column(Float)  # MAD per person per night
    water_bottles: Mapped[Optional[int]] = mapped_column(Integer)  # mineral water bottles for the day
    local_guide_cost: Mapped[Optional[float]] = mapped_column(Float)  # local guide cost for the day
    restaurant_lunch: Mapped[Optional[str]] = mapped_column(String(200))  # lunch restaurant name
    restaurant_dinner: Mapped[Optional[str]] = mapped_column(String(200))  # dinner restaurant name
    lunch_cost_pax: Mapped[Optional[float]] = mapped_column(Float)  # lunch cost per pax MAD
    dinner_cost_pax: Mapped[Optional[float]] = mapped_column(Float)  # dinner cost per pax MAD
    half_dbl_rate: Mapped[Optional[float]] = mapped_column(Float)  # hotel half-double rate MAD
    single_supplement: Mapped[Optional[float]] = mapped_column(Float)  # hotel SS for the day MAD
    monuments_detail: Mapped[Optional[dict]] = mapped_column(JSON)  # [{name, entry_status, fee_pax}]
    luggage_handling: Mapped[Optional[float]] = mapped_column(Float)  # porter/luggage cost MAD

    itinerary: Mapped["Itinerary"] = relationship("Itinerary", back_populates="days")

    __table_args__ = (Index("idx_iday_itinerary", "itinerary_id"),)
