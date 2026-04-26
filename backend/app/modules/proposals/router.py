"""Proposal sharing router — authenticated creation, public viewing."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.shared.schemas import BaseResponse
from app.modules.proposals.models import ProposalShare, ProposalComment
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.quotations.models import Quotation

router = APIRouter(prefix="/proposals", tags=["proposals"])


# ── Schemas ───────────────────────────────────────────────────────────

class ShareCreateRequest(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None


class CommentCreateRequest(BaseModel):
    author_name: str
    content: str
    day_number: Optional[int] = None

class SignRequest(BaseModel):
    signature_name: str
    signature_data: str # Base64 signature


class CommentOut(BaseResponse):
    share_id: str
    author_name: str
    content: str
    day_number: Optional[int]
    is_resolved: bool


class ShareOut(BaseResponse):
    project_id: str
    token: str
    expires_at: datetime
    is_accepted: bool
    views: int
    client_name: Optional[str]
    client_email: Optional[str]


class DayOut(BaseModel):
    id: str
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

    class Config:
        from_attributes = True


class ProposalViewOut(BaseModel):
    share: ShareOut
    project: dict
    days: list[DayOut]
    quotation_total: Optional[float]
    currency: str
    comments: list[CommentOut]

    class Config:
        from_attributes = True


# ── Authenticated endpoints ───────────────────────────────────────────

@router.post("/{project_id}/share", response_model=ShareOut, status_code=201,
             dependencies=[Depends(require_auth)])
def create_share(project_id: str, body: ShareCreateRequest, db: Session = Depends(get_db)):
    """Generate a shareable token for this project. Idempotent — returns existing active share."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Reuse existing active share if it exists
    existing = db.execute(
        select(ProposalShare).where(
            ProposalShare.project_id == project_id,
            ProposalShare.expires_at > datetime.now(timezone.utc),
        )
    ).scalars().first()

    if existing:
        if body.client_name:  existing.client_name = body.client_name
        if body.client_email: existing.client_email = body.client_email
        db.commit()
        db.refresh(existing)
        return existing

    share = ProposalShare(
        project_id=project_id,
        client_name=body.client_name or project.client_name,
        client_email=body.client_email or project.client_email,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


@router.get("/{project_id}/shares", response_model=list[ShareOut],
            dependencies=[Depends(require_auth)])
def list_shares(project_id: str, db: Session = Depends(get_db)):
    return db.execute(
        select(ProposalShare).where(ProposalShare.project_id == project_id)
    ).scalars().all()


# ── Public endpoints (no auth) ────────────────────────────────────────

@router.get("/view/{token}", response_model=ProposalViewOut)
def view_proposal(token: str, db: Session = Depends(get_db)):
    """Public endpoint — returns full proposal data for the shareable link."""
    share = db.execute(
        select(ProposalShare).where(ProposalShare.token == token)
    ).scalars().first()

    if not share:
        raise HTTPException(404, "Proposition introuvable")
    if share.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(410, "Ce lien a expiré")

    # Increment view counter
    share.views += 1
    db.commit()

    project = db.get(Project, share.project_id)
    if not project:
        raise HTTPException(404, "Projet introuvable")

    # Get itinerary days
    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == share.project_id)
    ).scalars().first()

    days: list[ItineraryDay] = []
    if itin:
        days = db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.itinerary_id == itin.id)
            .order_by(ItineraryDay.day_number)
        ).scalars().all()

    # Get quotation total
    quotation = db.execute(
        select(Quotation).where(Quotation.project_id == share.project_id)
    ).scalars().first()
    quotation_total = float(quotation.total_price) if quotation and quotation.total_price else None

    db.refresh(share)

    return ProposalViewOut(
        share=share,
        project={
            "id": project.id,
            "name": project.name,
            "reference": project.reference,
            "client_name": project.client_name,
            "destination": project.destination,
            "duration_days": project.duration_days,
            "duration_nights": project.duration_nights,
            "pax_count": project.pax_count,
            "travel_dates": project.travel_dates,
            "highlights": project.highlights or [],
            "inclusions": project.inclusions or [],
            "exclusions": project.exclusions or [],
            "cover_image_url": project.cover_image_url,
            "project_type": (project.project_type.value if hasattr(project.project_type, 'value') else project.project_type) if project.project_type else None,
            "is_signed": project.is_signed,
            "payment_status": project.payment_status,
        },
        days=days,
        quotation_total=quotation_total,
        currency=project.currency or "EUR",
        comments=share.comments,
    )


@router.post("/view/{token}/comments", response_model=CommentOut, status_code=201)
def add_comment(token: str, body: CommentCreateRequest, db: Session = Depends(get_db)):
    share = db.execute(
        select(ProposalShare).where(ProposalShare.token == token)
    ).scalars().first()
    if not share:
        raise HTTPException(404, "Proposition introuvable")

    comment = ProposalComment(
        share_id=share.id,
        author_name=body.author_name,
        content=body.content,
        day_number=body.day_number,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.post("/view/{token}/sign")
def sign_proposal(token: str, body: SignRequest, db: Session = Depends(get_db)):
    share = db.execute(select(ProposalShare).where(ProposalShare.token == token)).scalars().first()
    if not share: raise HTTPException(404)
    project = db.get(Project, share.project_id)
    
    project.is_signed = True
    project.signed_at = datetime.now(timezone.utc).isoformat()
    project.signature_data = body.signature_data
    db.commit()
    return {"ok": True}

@router.post("/view/{token}/pay")
def pay_proposal(token: str, db: Session = Depends(get_db)):
    share = db.execute(select(ProposalShare).where(ProposalShare.token == token)).scalars().first()
    if not share: raise HTTPException(404)
    project = db.get(Project, share.project_id)
    
    project.payment_status = "paid"
    project.paid_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"ok": True}


@router.patch("/view/{token}/accept")
def accept_proposal(token: str, db: Session = Depends(get_db)):
    share = db.execute(
        select(ProposalShare).where(ProposalShare.token == token)
    ).scalars().first()
    if not share:
        raise HTTPException(404, "Proposition introuvable")

    share.is_accepted = True
    db.commit()
    return {"message": "Proposition acceptée. L'équipe S'TOURS vous contactera sous 24h."}
