"""Menu module schemas — Pydantic request/response models."""

from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    HALF_BOARD = "half_board"
    FULL_BOARD = "full_board"
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


class MenuCreate(BaseModel):
    label: str = Field(..., min_length=2, max_length=300)
    meal_type: MealType
    category: MenuCategory = MenuCategory.STANDARD
    city: Optional[str] = None
    restaurant_name: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    unit_cost: float = Field(..., ge=0)
    currency: str = Field("MAD", max_length=10)
    min_pax: int = Field(1, ge=1)
    max_pax: Optional[int] = None
    has_vegetarian: bool = False
    has_vegan: bool = False
    has_halal: bool = True
    has_gluten_free: bool = False
    description: Optional[str] = None
    menu_items: Optional[list[dict[str, Any]]] = None
    notes: Optional[str] = None


class MenuUpdate(BaseModel):
    label: Optional[str] = None
    meal_type: Optional[MealType] = None
    category: Optional[MenuCategory] = None
    city: Optional[str] = None
    restaurant_name: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    unit_cost: Optional[float] = None
    currency: Optional[str] = None
    min_pax: Optional[int] = None
    max_pax: Optional[int] = None
    has_vegetarian: Optional[bool] = None
    has_vegan: Optional[bool] = None
    has_halal: Optional[bool] = None
    has_gluten_free: Optional[bool] = None
    description: Optional[str] = None
    menu_items: Optional[list[dict[str, Any]]] = None
    notes: Optional[str] = None


class MenuOut(BaseModel):
    id: str
    label: str
    meal_type: MealType
    category: MenuCategory
    city: Optional[str]
    restaurant_name: Optional[str]
    supplier_name: Optional[str]
    supplier_contact: Optional[str]
    unit_cost: float
    currency: str
    min_pax: int
    max_pax: Optional[int]
    has_vegetarian: bool
    has_vegan: bool
    has_halal: bool
    has_gluten_free: bool
    description: Optional[str]
    menu_items: Optional[list[dict[str, Any]]]
    notes: Optional[str]
    active: bool

    class Config:
        from_attributes = True
