"""Menus module models — Restaurant menu and meal package management.

Manages meal packages used in the quotation engine (half-board, full-board,
gala dinners, etc.) with per-pax pricing and dietary option tracking.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Numeric, Integer, Boolean, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    HALF_BOARD = "half_board"       # demi-pension
    FULL_BOARD = "full_board"       # pension complète
    COCKTAIL = "cocktail"
    GALA_DINNER = "gala_dinner"
    BBQ = "bbq"
    PICNIC = "picnic"
    COFFEE_BREAK = "coffee_break"
    OTHER = "other"


class MenuCategory(str, Enum):
    STANDARD = "standard"
    GASTRONOMIC = "gastronomic"
    TRADITIONAL = "traditional"
    BUFFET = "buffet"
    SET_MENU = "set_menu"
    SHOW_COOKING = "show_cooking"


class Menu(Base, BaseMixin):
    """Menu / meal package entry used in quotation lines."""

    __tablename__ = "menus"

    # Identity
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    meal_type: Mapped[MealType] = mapped_column(String(50), nullable=False, index=True)
    category: Mapped[MenuCategory] = mapped_column(
        String(50), nullable=False, default=MenuCategory.STANDARD, index=True
    )

    # Location
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    restaurant_name: Mapped[Optional[str]] = mapped_column(String(200))
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200))
    supplier_contact: Mapped[Optional[str]] = mapped_column(String(200))

    # Pricing (per pax)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")

    # Capacity constraints
    min_pax: Mapped[int] = mapped_column(Integer, default=1)
    max_pax: Mapped[Optional[int]] = mapped_column(Integer)

    # Options
    has_vegetarian: Mapped[bool] = mapped_column(Boolean, default=False)
    has_vegan: Mapped[bool] = mapped_column(Boolean, default=False)
    has_halal: Mapped[bool] = mapped_column(Boolean, default=True)
    has_gluten_free: Mapped[bool] = mapped_column(Boolean, default=False)

    # Menu description (courses, items, etc.)
    description: Mapped[Optional[str]] = mapped_column(Text)
    menu_items: Mapped[Optional[dict]] = mapped_column(JSON)  # [{course: "Entrée", item: "Harira"}]

    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        Index("idx_menu_city", "city"),
        Index("idx_menu_type", "meal_type"),
        Index("idx_menu_category", "category"),
    )
