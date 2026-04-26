"""Contracting — Contract / Season / Rate / Allotment models.

A Contract binds a Partner (supplier) to an Article (or article category),
valid over a date range, broken down into Seasons (e.g. low / shoulder / peak)
each with their own Rates and optional Allotments (capacity).

This feeds the Pricing Engine v2 which deterministically resolves
{ supplier, article, date, occupancy } → { unit_price, currency, allotment }.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import (
    String, Boolean, Numeric, JSON, ForeignKey, Date, Integer, Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class ContractStatus(str, Enum):
    draft = "draft"
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class Contract(Base, BaseMixin):
    __tablename__ = "contracts"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    code: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(255))
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="RESTRICT"), index=True,
    )
    article_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("articles.id", ondelete="SET NULL"), index=True,
    )
    # If article_id is null, contract applies to ALL articles of this category
    article_category: Mapped[Optional[str]] = mapped_column(String(32), index=True)

    status: Mapped[ContractStatus] = mapped_column(String(16), default=ContractStatus.draft, index=True)
    valid_from: Mapped[Date] = mapped_column(Date, index=True)
    valid_to: Mapped[Date] = mapped_column(Date, index=True)
    currency: Mapped[str] = mapped_column(String(3), default="MAD")

    # Commercial terms (free-form to stay flexible)
    payment_terms_days: Mapped[Optional[int]] = mapped_column(Integer)
    cancellation_policy: Mapped[Optional[dict]] = mapped_column(JSON)
    commission_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    notes: Mapped[Optional[str]] = mapped_column(String(2000))

    seasons: Mapped[list["ContractSeason"]] = relationship(
        "ContractSeason", back_populates="contract", cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_contract_company_supplier", "company_id", "supplier_id"),
        Index("idx_contract_validity", "valid_from", "valid_to"),
        UniqueConstraint("company_id", "code", name="uq_contract_company_code"),
    )


class ContractSeason(Base, BaseMixin):
    __tablename__ = "contract_seasons"

    contract_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contracts.id", ondelete="CASCADE"), index=True,
    )
    name: Mapped[str] = mapped_column(String(64))  # "low", "high", "peak", ...
    starts_on: Mapped[Date] = mapped_column(Date, index=True)
    ends_on: Mapped[Date] = mapped_column(Date, index=True)

    contract: Mapped[Contract] = relationship("Contract", back_populates="seasons")
    rates: Mapped[list["ContractRate"]] = relationship(
        "ContractRate", back_populates="season", cascade="all, delete-orphan",
    )
    allotments: Mapped[list["Allotment"]] = relationship(
        "Allotment", back_populates="season", cascade="all, delete-orphan",
    )


class ContractRate(Base, BaseMixin):
    __tablename__ = "contract_rates"

    season_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contract_seasons.id", ondelete="CASCADE"), index=True,
    )
    # Selector: room type / pax / vehicle / occupancy
    rate_key: Mapped[str] = mapped_column(String(64), index=True)  # e.g. "DBL", "SGL", "ADULT"
    pax_min: Mapped[Optional[int]] = mapped_column(Integer)
    pax_max: Mapped[Optional[int]] = mapped_column(Integer)

    unit_price: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MAD")
    notes: Mapped[Optional[str]] = mapped_column(String(500))

    season: Mapped[ContractSeason] = relationship("ContractSeason", back_populates="rates")


class Allotment(Base, BaseMixin):
    __tablename__ = "allotments"

    season_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contract_seasons.id", ondelete="CASCADE"), index=True,
    )
    rate_key: Mapped[Optional[str]] = mapped_column(String(64), index=True)

    quantity: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[int] = mapped_column(Integer, default=0)
    release_days_before: Mapped[Optional[int]] = mapped_column(Integer)

    season: Mapped[ContractSeason] = relationship("ContractSeason", back_populates="allotments")

    @property
    def remaining(self) -> int:
        return max(0, (self.quantity or 0) - (self.consumed or 0))
