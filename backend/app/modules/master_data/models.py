"""Master Data — unified Partner & Article catalog.

Replaces fragmented inventories (hotels / restaurants / guides / transports)
with two universal entities:

    Partner  →  Customer | Supplier | Guide | Employee | SubAgent
    Article  →  Hotel night, Meal, Guide day, Transport, Excursion, etc.

Existing inventory tables (hotels, transports, guides) are NOT dropped — they
can be migrated incrementally via scripts/migrate_inventory_to_master_data.py.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Boolean, Numeric, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


# ── Partner ────────────────────────────────────────────────────────

class PartnerType(str, Enum):
    customer = "customer"
    supplier = "supplier"
    guide = "guide"
    employee = "employee"
    sub_agent = "sub_agent"


class Partner(Base, BaseMixin):
    __tablename__ = "partners"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    code: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[PartnerType] = mapped_column(String(20), index=True)

    # Contact & legal
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(64))
    address: Mapped[Optional[dict]] = mapped_column(JSON)
    tax_id: Mapped[Optional[str]] = mapped_column(String(64))
    bank_iban: Mapped[Optional[str]] = mapped_column(String(64))
    bank_swift: Mapped[Optional[str]] = mapped_column(String(16))

    # Commercial
    currency: Mapped[str] = mapped_column(String(3), default="MAD")
    payment_terms_days: Mapped[Optional[int]] = mapped_column()
    credit_limit: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))

    # Mapping back to legacy inventory (hotel.id, etc.) for soft migration.
    legacy_table: Mapped[Optional[str]] = mapped_column(String(64))
    legacy_id: Mapped[Optional[str]] = mapped_column(String(36))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    __table_args__ = (
        Index("idx_partner_company_code", "company_id", "code", unique=True),
        Index("idx_partner_company_type", "company_id", "type"),
        Index("idx_partner_legacy", "legacy_table", "legacy_id"),
    )


# ── Article ────────────────────────────────────────────────────────

class ArticleCategory(str, Enum):
    hotel_night = "hotel_night"
    meal = "meal"
    guide_day = "guide_day"
    transport = "transport"
    excursion = "excursion"
    visa = "visa"
    insurance = "insurance"
    flight = "flight"
    other = "other"


class Article(Base, BaseMixin):
    __tablename__ = "articles"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    code: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[ArticleCategory] = mapped_column(String(32), index=True)
    unit: Mapped[str] = mapped_column(String(32), default="unit")  # nuitée|repas|jour|km|forfait|...

    # Default pricing (used as fallback when no contract applies)
    purchase_price: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    sell_price: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MAD")
    vat_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))

    # Default supplier (most common provider — the contracting module uses this
    # to look up active contracts when pricing.)
    default_supplier_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="SET NULL"), index=True,
    )

    # Free-form attributes for category-specific fields (room_type, capacity, etc.)
    attributes: Mapped[Optional[dict]] = mapped_column(JSON)

    # Mapping back to legacy table for migration.
    legacy_table: Mapped[Optional[str]] = mapped_column(String(64))
    legacy_id: Mapped[Optional[str]] = mapped_column(String(36))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    __table_args__ = (
        Index("idx_article_company_code", "company_id", "code", unique=True),
        Index("idx_article_company_category", "company_id", "category"),
        Index("idx_article_legacy", "legacy_table", "legacy_id"),
    )
