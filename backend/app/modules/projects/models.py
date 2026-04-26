"""Project models — Central entity linking all components."""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Integer, Numeric, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    VALIDATED = "validated"
    SENT = "sent"
    WON = "won"
    LOST = "lost"


class ProjectType(str, Enum):
    INCENTIVE = "incentive"
    LEISURE = "leisure"
    MICE = "mice"
    FIT = "fit"
    LUXURY = "luxury"


class Project(Base, BaseMixin):
    """Central project entity — source of truth for all outputs."""

    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(200))
    client_email: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[ProjectStatus] = mapped_column(String(50), default=ProjectStatus.DRAFT, index=True)
    project_type: Mapped[Optional[ProjectType]] = mapped_column(String(50))
    destination: Mapped[Optional[str]] = mapped_column(String(200))
    duration_days: Mapped[Optional[int]] = mapped_column(Integer)
    duration_nights: Mapped[Optional[int]] = mapped_column(Integer)
    pax_count: Mapped[Optional[int]] = mapped_column(Integer)
    travel_dates: Mapped[Optional[str]] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(String(10), default="fr")
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[dict]] = mapped_column(JSON)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    map_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    highlights: Mapped[Optional[dict]] = mapped_column(JSON)  # list of strings
    inclusions: Mapped[Optional[dict]] = mapped_column(JSON)  # list of strings
    exclusions: Mapped[Optional[dict]] = mapped_column(JSON)  # list of strings
    # Contract & Payment
    is_signed: Mapped[bool] = mapped_column(default=False)
    signed_at: Mapped[Optional[str]] = mapped_column(String(50))
    signature_data: Mapped[Optional[str]] = mapped_column(Text) # Base64 or JSON
    payment_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, partial, paid
    paid_at: Mapped[Optional[str]] = mapped_column(String(50))
    client_country: Mapped[Optional[str]] = mapped_column(String(100))

    # White-Label & Branding
    branding_config: Mapped[Optional[dict]] = mapped_column(JSON) # {primary_color: str, logo_url: str, partner_name: str}

    # Hyper-Personalization & Safety
    pax_profiles: Mapped[Optional[dict]] = mapped_column(JSON) # List of {name: str, allergies: [], dietary: str, notes: str}

    # Travel Designer — guide & logistics rules (S'TOURS parity)
    guide_rules: Mapped[Optional[dict]] = mapped_column(JSON)
    # {main_language: "EN", local_guide_threshold_pax: 20,
    #  local_guide_cities: ["Fes","Chefchaouen","Midelt"], daily_rate: 1000, currency: "MAD"}
    water_policy: Mapped[Optional[dict]] = mapped_column(JSON)
    # {bottles_per_pax_per_day: 1, cost_per_bottle: 5, currency: "MAD"}
    competitor_name: Mapped[Optional[str]] = mapped_column(String(200))
    km_total: Mapped[Optional[int]] = mapped_column(Integer)
    bus_rate_per_km: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))

    # Sub-agent (B2B reseller) attribution; nullable for direct sales.
    sub_agent_partner_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    # Relationships
    quotations: Mapped[list["Quotation"]] = relationship(
        "Quotation", back_populates="project", cascade="all, delete-orphan"
    )
    itineraries: Mapped[list["Itinerary"]] = relationship(
        "Itinerary", back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_project_status", "status"),
        Index("idx_project_client", "client_name"),
    )
