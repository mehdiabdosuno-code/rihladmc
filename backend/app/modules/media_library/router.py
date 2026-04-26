"""Media Library router (B2) — shared photos & POI descriptions across DMC team."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant import get_optional_company_id
from app.modules.media_library.models import MediaAsset
from app.shared.exceptions import NotFoundError
from app.shared.schemas import BaseResponse
from app.shared.dependencies import require_auth


router = APIRouter(
    prefix="/media-library",
    tags=["media-library"],
    dependencies=[Depends(require_auth)],
)


class AssetCreate(BaseModel):
    asset_type: str = "photo"
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = "Maroc"
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    language: str = "fr"
    image_url: Optional[str] = None
    thumb_url: Optional[str] = None
    source: Optional[str] = None
    license: Optional[str] = None
    is_public: bool = False


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    image_url: Optional[str] = None
    thumb_url: Optional[str] = None
    is_public: Optional[bool] = None


class AssetResponse(BaseResponse):
    company_id: Optional[str]
    asset_type: str
    title: str
    subtitle: Optional[str]
    description: Optional[str]
    city: Optional[str]
    country: Optional[str]
    category: Optional[str]
    tags: Optional[list]
    language: str
    image_url: Optional[str]
    thumb_url: Optional[str]
    source: Optional[str]
    license: Optional[str]
    is_public: bool
    use_count: int


class AssetFacets(BaseModel):
    cities: list[dict]
    categories: list[dict]
    types: list[dict]


def _scope(company_id: Optional[str]):
    if company_id:
        return or_(
            MediaAsset.company_id == company_id,
            MediaAsset.company_id.is_(None),
            MediaAsset.is_public.is_(True),
        )
    return or_(MediaAsset.is_public.is_(True), MediaAsset.company_id.is_(None))


def _ownership(company_id: Optional[str]):
    if company_id:
        return or_(MediaAsset.company_id == company_id, MediaAsset.company_id.is_(None))
    return MediaAsset.company_id.is_(None)


@router.get("/", response_model=list[AssetResponse])
def list_assets(
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
    q: Optional[str] = None,
    asset_type: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = Query(200, le=500),
):
    stmt = select(MediaAsset).where(_scope(company_id))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            MediaAsset.title.ilike(like),
            MediaAsset.description.ilike(like),
            MediaAsset.city.ilike(like),
        ))
    if asset_type:
        stmt = stmt.where(MediaAsset.asset_type == asset_type)
    if city:
        stmt = stmt.where(MediaAsset.city.ilike(f"%{city}%"))
    if category:
        stmt = stmt.where(MediaAsset.category == category)
    if tag:
        # JSON contains: SQLite-friendly LIKE on serialized form
        stmt = stmt.where(func.cast(MediaAsset.tags, type_=__import__("sqlalchemy").String).ilike(f"%{tag}%"))
    stmt = stmt.order_by(MediaAsset.use_count.desc(), MediaAsset.updated_at.desc()).limit(limit)
    return db.execute(stmt).scalars().all()


@router.get("/facets", response_model=AssetFacets)
def get_facets(
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    rows = db.execute(select(MediaAsset).where(_scope(company_id))).scalars().all()
    cities: dict[str, int] = {}
    cats: dict[str, int] = {}
    types: dict[str, int] = {}
    for r in rows:
        if r.city:
            cities[r.city] = cities.get(r.city, 0) + 1
        if r.category:
            cats[r.category] = cats.get(r.category, 0) + 1
        types[r.asset_type] = types.get(r.asset_type, 0) + 1
    return AssetFacets(
        cities=[{"value": k, "count": v} for k, v in sorted(cities.items(), key=lambda x: -x[1])],
        categories=[{"value": k, "count": v} for k, v in sorted(cats.items(), key=lambda x: -x[1])],
        types=[{"value": k, "count": v} for k, v in sorted(types.items(), key=lambda x: -x[1])],
    )


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    a = db.execute(
        select(MediaAsset).where(and_(MediaAsset.id == asset_id, _scope(company_id)))
    ).scalars().first()
    if not a:
        raise NotFoundError("Asset not found")
    return a


@router.post("/", response_model=AssetResponse, status_code=201)
def create_asset(
    data: AssetCreate,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    a = MediaAsset(company_id=company_id, **data.model_dump())
    if not a.thumb_url:
        a.thumb_url = a.image_url
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.post("/{asset_id}/use", response_model=AssetResponse)
def increment_use(
    asset_id: str,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    a = db.execute(
        select(MediaAsset).where(and_(MediaAsset.id == asset_id, _scope(company_id)))
    ).scalars().first()
    if not a:
        raise NotFoundError("Asset not found")
    a.use_count = (a.use_count or 0) + 1
    db.commit()
    db.refresh(a)
    return a


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: str,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    a = db.execute(
        select(MediaAsset).where(and_(MediaAsset.id == asset_id, _ownership(company_id)))
    ).scalars().first()
    if not a:
        raise NotFoundError("Asset not found or not editable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    a = db.execute(
        select(MediaAsset).where(and_(MediaAsset.id == asset_id, _ownership(company_id)))
    ).scalars().first()
    if not a:
        raise NotFoundError("Asset not found or not deletable")
    db.delete(a)
    db.commit()
