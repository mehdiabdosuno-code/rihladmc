"""Menus router — Full CRUD for meal packages catalogue.

Endpoints:
    GET    /menus/               — List all (with filters)
    POST   /menus/               — Create menu entry
    GET    /menus/{id}           — Get by ID
    PUT    /menus/{id}           — Full update
    PATCH  /menus/{id}           — Partial update
    DELETE /menus/{id}           — Soft delete (active=False)
    GET    /menus/search/query   — Search by city/label
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.core.database import get_db
from app.shared.dependencies import require_auth, require_role
from app.modules.menus.models import Menu, MealType, MenuCategory
from app.modules.menus.schemas import MenuCreate, MenuUpdate, MenuOut

router = APIRouter(prefix="/menus", tags=["menus"], dependencies=[Depends(require_auth)])


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[MenuOut], summary="List menu catalogue")
def list_menus(
    meal_type: Optional[MealType] = Query(None),
    category: Optional[MenuCategory] = Query(None),
    city: Optional[str] = Query(None),
    has_halal: Optional[bool] = Query(None),
    has_vegetarian: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List menu entries with optional filters."""
    q = select(Menu).where(Menu.active == True)

    if meal_type:
        q = q.where(Menu.meal_type == meal_type)
    if category:
        q = q.where(Menu.category == category)
    if city:
        q = q.where(Menu.city.ilike(f"%{city}%"))
    if has_halal is not None:
        q = q.where(Menu.has_halal == has_halal)
    if has_vegetarian is not None:
        q = q.where(Menu.has_vegetarian == has_vegetarian)

    q = q.order_by(Menu.city, Menu.meal_type, Menu.label).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=MenuOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create menu entry",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def create_menu(payload: MenuCreate, db: Session = Depends(get_db)):
    """Create a new menu catalogue entry."""
    menu = Menu(**payload.model_dump())
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------
@router.get("/{menu_id}", response_model=MenuOut, summary="Get menu by ID")
def get_menu(menu_id: str, db: Session = Depends(get_db)):
    menu = db.get(Menu, menu_id)
    if not menu or not menu.active:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' introuvable.")
    return menu


# ---------------------------------------------------------------------------
# UPDATE (full)
# ---------------------------------------------------------------------------
@router.put(
    "/{menu_id}",
    response_model=MenuOut,
    summary="Full update menu",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def update_menu(menu_id: str, payload: MenuCreate, db: Session = Depends(get_db)):
    menu = db.get(Menu, menu_id)
    if not menu or not menu.active:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' introuvable.")
    for field, value in payload.model_dump().items():
        setattr(menu, field, value)
    db.commit()
    db.refresh(menu)
    return menu


# ---------------------------------------------------------------------------
# PATCH (partial)
# ---------------------------------------------------------------------------
@router.patch(
    "/{menu_id}",
    response_model=MenuOut,
    summary="Partial update menu",
    dependencies=[Depends(require_role("super_admin", "sales_director", "travel_designer"))],
)
def patch_menu(menu_id: str, payload: MenuUpdate, db: Session = Depends(get_db)):
    menu = db.get(Menu, menu_id)
    if not menu or not menu.active:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' introuvable.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(menu, field, value)
    db.commit()
    db.refresh(menu)
    return menu


# ---------------------------------------------------------------------------
# DELETE (soft)
# ---------------------------------------------------------------------------
@router.delete(
    "/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete menu",
    dependencies=[Depends(require_role("super_admin", "sales_director"))],
)
def delete_menu(menu_id: str, db: Session = Depends(get_db)):
    menu = db.get(Menu, menu_id)
    if not menu or not menu.active:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' introuvable.")
    menu.active = False
    db.commit()


# ---------------------------------------------------------------------------
# SEARCH
# ---------------------------------------------------------------------------
@router.get("/search/query", response_model=list[MenuOut], summary="Search menus")
def search_menus(
    q: str = Query(..., min_length=2, description="Search in label, city, restaurant name"),
    db: Session = Depends(get_db),
):
    """Full-text search on label, city, restaurant_name, supplier_name."""
    results = db.execute(
        select(Menu).where(
            Menu.active == True,
            or_(
                Menu.label.ilike(f"%{q}%"),
                Menu.city.ilike(f"%{q}%"),
                Menu.restaurant_name.ilike(f"%{q}%"),
                Menu.supplier_name.ilike(f"%{q}%"),
            )
        ).order_by(Menu.city, Menu.label).limit(50)
    ).scalars().all()
    return results
