"""Company & UserCompany models — Multi-tenancy foundation."""

from typing import Optional
from sqlalchemy import String, Boolean, Integer, JSON, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class Company(Base, BaseMixin):
    """Tenant entity. Every domain entity points to a company."""

    __tablename__ = "companies"

    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="ICE Maroc / VAT number",
    )
    address: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="MAD")
    fiscal_year_start: Mapped[int] = mapped_column(Integer, default=1)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    user_companies: Mapped[list["UserCompany"]] = relationship(
        "UserCompany",
        back_populates="company",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_company_code_active", "code", "is_active"),)


class UserCompany(Base, BaseMixin):
    """Maps users to companies with per-company role.

    A user can belong to multiple companies; one is marked default.
    """

    __tablename__ = "user_companies"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True,
    )
    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        comment="Per-company role override (uses RoleEnum values)",
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    company: Mapped[Company] = relationship("Company", back_populates="user_companies")

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company"),
        Index("idx_user_company_default", "user_id", "is_default"),
    )
