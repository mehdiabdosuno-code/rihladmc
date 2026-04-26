"""Itinerary Templates router (B1) — reusable circuit blueprints."""

from typing import Optional
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant import get_optional_company_id
from app.modules.itinerary_templates.models import ItineraryTemplate, ItineraryTemplateDay
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.shared.exceptions import NotFoundError
from app.shared.schemas import BaseResponse
from app.shared.dependencies import require_auth


router = APIRouter(
    prefix="/itinerary-templates",
    tags=["itinerary-templates"],
    dependencies=[Depends(require_auth)],
)


# ───────────────────────── Schemas ──────────────────────────────────────────

class TemplateDayPayload(BaseModel):
    day_number: int
    title: str
    subtitle: Optional[str] = None
    city: Optional[str] = None
    description: Optional[str] = None
    hotel: Optional[str] = None
    hotel_category: Optional[str] = None
    meal_plan: Optional[str] = None
    travel_time: Optional[str] = None
    distance_km: Optional[int] = None
    activities: Optional[list[str]] = None
    image_url: Optional[str] = None
    image_url_2: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    destination: Optional[str] = None
    duration_days: int = 0
    language: str = "fr"
    hotel_category: Optional[str] = None
    target_audience: Optional[str] = None
    tags: Optional[list[str]] = None
    thumbnail_url: Optional[str] = None
    is_public: bool = False
    days: list[TemplateDayPayload] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    destination: Optional[str] = None
    duration_days: Optional[int] = None
    language: Optional[str] = None
    hotel_category: Optional[str] = None
    target_audience: Optional[str] = None
    tags: Optional[list[str]] = None
    thumbnail_url: Optional[str] = None
    is_public: Optional[bool] = None


class TemplateDayResponse(BaseResponse):
    template_id: str
    day_number: int
    title: str
    subtitle: Optional[str]
    city: Optional[str]
    description: Optional[str]
    hotel: Optional[str]
    hotel_category: Optional[str]
    meal_plan: Optional[str]
    travel_time: Optional[str]
    distance_km: Optional[int]
    activities: Optional[list]
    image_url: Optional[str]
    image_url_2: Optional[str]


class TemplateResponse(BaseResponse):
    company_id: Optional[str]
    name: str
    description: Optional[str]
    destination: Optional[str]
    duration_days: int
    language: str
    hotel_category: Optional[str]
    target_audience: Optional[str]
    tags: Optional[list]
    thumbnail_url: Optional[str]
    is_public: bool
    use_count: int
    days: list[TemplateDayResponse] = []


class TemplateSummary(BaseResponse):
    company_id: Optional[str]
    name: str
    description: Optional[str]
    destination: Optional[str]
    duration_days: int
    language: str
    hotel_category: Optional[str]
    target_audience: Optional[str]
    tags: Optional[list]
    thumbnail_url: Optional[str]
    is_public: bool
    use_count: int


class ApplyTemplateRequest(BaseModel):
    project_id: str
    overwrite: bool = False  # if False and project already has an itinerary, append a new version


# ───────────────────────── Helpers ──────────────────────────────────────────

def _scope_filter(company_id: Optional[str]):
    """Visible templates: own company + public + (legacy) untenanted."""
    if company_id:
        return or_(
            ItineraryTemplate.company_id == company_id,
            ItineraryTemplate.company_id.is_(None),
            ItineraryTemplate.is_public.is_(True),
        )
    return or_(ItineraryTemplate.is_public.is_(True), ItineraryTemplate.company_id.is_(None))


def _ownership_filter(company_id: Optional[str]):
    """Editable templates: own company + (legacy) untenanted."""
    if company_id:
        return or_(ItineraryTemplate.company_id == company_id, ItineraryTemplate.company_id.is_(None))
    return ItineraryTemplate.company_id.is_(None)


# ───────────────────────── Endpoints ────────────────────────────────────────

@router.get("/", response_model=list[TemplateSummary])
def list_templates(
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
    search: Optional[str] = None,
    destination: Optional[str] = None,
    audience: Optional[str] = None,
    min_days: Optional[int] = None,
    max_days: Optional[int] = None,
    limit: int = Query(100, le=200),
):
    stmt = select(ItineraryTemplate).where(_scope_filter(company_id))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(
            ItineraryTemplate.name.ilike(like),
            ItineraryTemplate.description.ilike(like),
            ItineraryTemplate.destination.ilike(like),
        ))
    if destination:
        stmt = stmt.where(ItineraryTemplate.destination.ilike(f"%{destination}%"))
    if audience:
        stmt = stmt.where(ItineraryTemplate.target_audience == audience)
    if min_days is not None:
        stmt = stmt.where(ItineraryTemplate.duration_days >= min_days)
    if max_days is not None:
        stmt = stmt.where(ItineraryTemplate.duration_days <= max_days)
    stmt = stmt.order_by(ItineraryTemplate.use_count.desc(), ItineraryTemplate.updated_at.desc()).limit(limit)
    return db.execute(stmt).scalars().all()


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    tpl = db.execute(
        select(ItineraryTemplate).where(
            and_(ItineraryTemplate.id == template_id, _scope_filter(company_id))
        )
    ).scalars().first()
    if not tpl:
        raise NotFoundError(f"Template {template_id} not found")
    return tpl


@router.post("/", response_model=TemplateResponse, status_code=201)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    company_id: str | None = Depends(get_optional_company_id),
):
    tpl = ItineraryTemplate(
        company_id=company_id,
        **data.model_dump(exclude={"days"}),
    )
    if not tpl.duration_days and data.days:
        tpl.duration_days = len(data.days)
    db.add(tpl)
    db.flush()
    for d in data.days:
        db.add(ItineraryTemplateDay(template_id=tpl.id, **d.model_dump()))
    db.commit()
    db.refresh(tpl)
    return tpl


@router.post("/from-itinerary/{itinerary_id}", response_model=TemplateResponse, status_code=201)
def save_itinerary_as_template(
    itinerary_id: str,
    name: str = Query(..., min_length=2),
    description: Optional[str] = None,
    is_public: bool = False,
    db: Session = Depends(get_db),
    company_id: str | None = Depends(get_optional_company_id),
):
    """Clone an existing project itinerary into a reusable template."""
    itin = db.execute(select(Itinerary).where(Itinerary.id == itinerary_id)).scalars().first()
    if not itin:
        raise NotFoundError("Itinerary not found")

    days = list(itin.days or [])
    destination = ", ".join(sorted({d.city for d in days if d.city})) or None
    hotel_categories = sorted({d.hotel_category for d in days if d.hotel_category})
    hotel_category = hotel_categories[0] if len(hotel_categories) == 1 else ("mixed" if hotel_categories else None)

    tpl = ItineraryTemplate(
        company_id=company_id,
        name=name,
        description=description,
        destination=destination,
        duration_days=len(days),
        language=itin.language,
        hotel_category=hotel_category,
        is_public=is_public,
    )
    db.add(tpl)
    db.flush()
    for d in days:
        db.add(ItineraryTemplateDay(
            template_id=tpl.id,
            day_number=d.day_number,
            title=d.title,
            subtitle=d.subtitle,
            city=d.city,
            description=d.description,
            hotel=d.hotel,
            hotel_category=d.hotel_category,
            meal_plan=d.meal_plan,
            travel_time=d.travel_time,
            distance_km=d.distance_km,
            activities=d.activities,
            image_url=d.image_url,
            image_url_2=d.image_url_2,
        ))
    db.commit()
    db.refresh(tpl)
    return tpl


@router.post("/{template_id}/apply", status_code=201)
def apply_template_to_project(
    template_id: str,
    body: ApplyTemplateRequest,
    db: Session = Depends(get_db),
    company_id: Optional[str] = Depends(get_optional_company_id),
):
    """Create a new itinerary in the target project, seeded from the template."""
    tpl = db.execute(
        select(ItineraryTemplate).where(
            and_(ItineraryTemplate.id == template_id, _scope_filter(company_id))
        )
    ).scalars().first()
    if not tpl:
        raise NotFoundError("Template not found")

    if body.overwrite:
        existing = db.execute(
            select(Itinerary).where(Itinerary.project_id == body.project_id)
        ).scalars().all()
        for e in existing:
            db.delete(e)
        db.flush()

    next_version = 1 + (db.execute(
        select(Itinerary).where(Itinerary.project_id == body.project_id)
    ).scalars().all().__len__())

    itin = Itinerary(project_id=body.project_id, language=tpl.language, version=next_version)
    db.add(itin)
    db.flush()
    for d in tpl.days:
        db.add(ItineraryDay(
            itinerary_id=itin.id,
            day_number=d.day_number,
            title=d.title,
            subtitle=d.subtitle,
            city=d.city,
            description=d.description,
            hotel=d.hotel,
            hotel_category=d.hotel_category,
            meal_plan=d.meal_plan,
            travel_time=d.travel_time,
            distance_km=d.distance_km,
            activities=d.activities,
            image_url=d.image_url,
            image_url_2=d.image_url_2,
        ))

    tpl.use_count = (tpl.use_count or 0) + 1
    db.commit()
    db.refresh(itin)
    return {"itinerary_id": itin.id, "project_id": body.project_id, "days_created": len(tpl.days)}


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    company_id: str | None = Depends(get_optional_company_id),
):
    tpl = db.execute(
        select(ItineraryTemplate).where(
            and_(
                ItineraryTemplate.id == template_id,
                _ownership_filter(company_id),
            )
        )
    ).scalars().first()
    if not tpl:
        raise NotFoundError("Template not found or not editable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tpl, field, value)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    company_id: str | None = Depends(get_optional_company_id),
):
    tpl = db.execute(
        select(ItineraryTemplate).where(
            and_(
                ItineraryTemplate.id == template_id,
                _ownership_filter(company_id),
            )
        )
    ).scalars().first()
    if not tpl:
        raise NotFoundError("Template not found or not deletable")
    db.delete(tpl)
    db.commit()
