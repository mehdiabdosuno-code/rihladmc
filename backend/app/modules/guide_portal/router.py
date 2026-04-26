"""Guide Portal — agenda de travail et remarques sur les circuits."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.guide_portal.models import (
    GuideAvailability, AvailabilityStatus,
    CircuitRemark, RemarkType,
)
from app.modules.notifications.service import push_notification

router = APIRouter(prefix="/guide-portal", tags=["guide-portal"], dependencies=[Depends(require_auth)])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AvailabilityUpsert(BaseModel):
    date:       str   # YYYY-MM-DD
    status:     AvailabilityStatus = AvailabilityStatus.AVAILABLE
    project_id: Optional[str] = None
    notes:      Optional[str] = None


class RemarkCreate(BaseModel):
    project_id:       str
    itinerary_day_id: Optional[str] = None
    day_number:       Optional[int] = None
    remark_type:      RemarkType = RemarkType.OBSERVATION
    content:          str


class RemarkResolve(BaseModel):
    is_resolved: bool


# ── Agenda ────────────────────────────────────────────────────────────────────

@router.get("/agenda")
def get_my_agenda(
    month: Optional[str] = None,   # YYYY-MM
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    q = select(GuideAvailability).where(GuideAvailability.guide_id == current_user["sub"])
    if month:
        q = q.where(GuideAvailability.date.startswith(month))
    return db.execute(q.order_by(GuideAvailability.date)).scalars().all()


@router.put("/agenda/{date}")
def upsert_availability(
    date: str,
    data: AvailabilityUpsert,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    existing = db.execute(
        select(GuideAvailability).where(
            GuideAvailability.guide_id == current_user["sub"],
            GuideAvailability.date == date,
        )
    ).scalars().first()

    if existing:
        existing.status     = data.status
        existing.project_id = data.project_id
        existing.notes      = data.notes
    else:
        existing = GuideAvailability(
            guide_id=current_user["sub"],
            date=date,
            status=data.status,
            project_id=data.project_id,
            notes=data.notes,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


@router.get("/agenda/project/{project_id}")
def get_project_guide_agenda(project_id: str, db: Session = Depends(get_db)):
    """Travel designer: voir l'agenda des guides assignés à un projet."""
    rows = db.execute(
        select(GuideAvailability).where(GuideAvailability.project_id == project_id)
        .order_by(GuideAvailability.date)
    ).scalars().all()
    return rows


# ── Remarques circuit ─────────────────────────────────────────────────────────

@router.post("/remarks", status_code=201)
async def add_remark(
    data: RemarkCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    remark = CircuitRemark(
        guide_id=current_user["sub"],
        guide_name=current_user.get("full_name", "Guide"),
        project_id=data.project_id,
        itinerary_day_id=data.itinerary_day_id,
        day_number=data.day_number,
        remark_type=data.remark_type,
        content=data.content,
    )
    db.add(remark)
    db.commit()
    db.refresh(remark)

    label = {"observation": "Observation", "issue": "Problème signalé", "suggestion": "Suggestion"}.get(data.remark_type, "Remarque")
    day_info = f" — Jour {data.day_number}" if data.day_number else ""

    await push_notification(
        db=db,
        project_id=data.project_id,
        sender_name=current_user.get("full_name", "Guide"),
        notif_type="remark",
        title=f"{label}{day_info}",
        message=data.content[:150],
    )

    return remark


@router.get("/remarks/project/{project_id}")
def get_project_remarks(project_id: str, db: Session = Depends(get_db)):
    rows = db.execute(
        select(CircuitRemark).where(CircuitRemark.project_id == project_id)
        .order_by(CircuitRemark.created_at.desc())
    ).scalars().all()
    return rows


@router.patch("/remarks/{remark_id}/resolve")
def resolve_remark(
    remark_id: str,
    data: RemarkResolve,
    db: Session = Depends(get_db),
):
    remark = db.get(CircuitRemark, remark_id)
    if not remark:
        raise HTTPException(404, "Remarque introuvable")
    remark.is_resolved = data.is_resolved
    db.commit()
    return remark
