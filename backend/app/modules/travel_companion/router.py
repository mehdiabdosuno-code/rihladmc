"""Travel Companion router.

Two surfaces:
- /api/travel-links/*   — agency-side, JWT-protected, multi-tenant.
- /api/companion/*      — client-side, no JWT, magic-link token in URL.
"""

import os
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.companies.models import Company
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.travel_companion.models import TravelLink, TravelMessage
from app.modules.travel_companion.schemas import (
    TravelLinkCreate,
    TravelLinkOut,
    TravelLinkPublic,
    TravelMessageCreate,
    TravelMessageOut,
    TripBranding,
    TripContact,
    TripDay,
    TripPublicView,
)
from app.modules.travel_companion.service import (
    create_link,
    get_active_link,
    revoke_link,
    touch_link,
)
from app.modules.notifications.service import dispatch_to_project


# ── Agency-side ───────────────────────────────────────────────────

agency_router = APIRouter(prefix="/travel-links", tags=["travel-companion"])


def _public_url(token: str) -> str:
    base = os.getenv("PUBLIC_FRONTEND_URL", "https://app.stours.ma").rstrip("/")
    return f"{base}/companion/{token}"


@agency_router.post("", response_model=TravelLinkPublic, status_code=201)
def create_travel_link(
    payload: TravelLinkCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == payload.project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    # Optional company isolation if Project carries company_id
    project_company = getattr(project, "company_id", None)
    if project_company and project_company != company_id:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    link = create_link(
        db, company_id, payload.project_id,
        expires_at=payload.expires_at,
        pin=payload.pin,
        locale=payload.locale,
    )
    return TravelLinkPublic(
        token=link.token,
        url=_public_url(link.token),
        pin=link.pin,
        expires_at=link.expires_at,
    )


@agency_router.get("/project/{project_id}", response_model=list[TravelLinkOut])
def list_links_for_project(
    project_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return (
        db.query(TravelLink)
        .filter(TravelLink.project_id == project_id, TravelLink.company_id == company_id)
        .order_by(TravelLink.created_at.desc())
        .all()
    )


@agency_router.post("/{link_id}/revoke", response_model=TravelLinkOut)
def revoke(
    link_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    link = (
        db.query(TravelLink)
        .filter(TravelLink.id == link_id, TravelLink.company_id == company_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Lien introuvable")
    return revoke_link(db, link)


@agency_router.get("/{project_id}/messages", response_model=list[TravelMessageOut])
def list_messages(
    project_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return (
        db.query(TravelMessage)
        .filter(
            TravelMessage.project_id == project_id,
            TravelMessage.company_id == company_id,
        )
        .order_by(TravelMessage.created_at.desc())
        .all()
    )


# ── Client-side (no auth) ─────────────────────────────────────────

public_router = APIRouter(prefix="/companion", tags=["travel-companion"])


def _resolve_link_or_404(token: str, db: Session, pin: Optional[str] = None) -> TravelLink:
    link = get_active_link(db, token)
    if not link:
        raise HTTPException(status_code=404, detail="Lien expiré ou invalide")
    if link.pin and pin != link.pin:
        raise HTTPException(status_code=401, detail="Code PIN requis ou incorrect")
    return link


def _trip_view_for_link(db: Session, link: TravelLink) -> TripPublicView:
    project = db.query(Project).filter(Project.id == link.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    # Branding from Company; falls back to project.branding_config
    company = db.query(Company).filter(Company.id == link.company_id).first()
    branding_config = getattr(project, "branding_config", None) or {}
    branding = TripBranding(
        company_name=branding_config.get("partner_name") or (company.name if company else "STOURS VOYAGES"),
        logo_url=branding_config.get("logo_url"),
        primary_color=branding_config.get("primary_color") or "#3730a3",
        welcome_message=branding_config.get("welcome_message"),
    )

    # Itinerary
    itinerary = (
        db.query(Itinerary)
        .filter(Itinerary.project_id == project.id)
        .order_by(Itinerary.version.desc())
        .first()
    )
    days: list[TripDay] = []
    base_date: Optional[date] = getattr(project, "start_date", None)
    if itinerary:
        rows = (
            db.query(ItineraryDay)
            .filter(ItineraryDay.itinerary_id == itinerary.id)
            .order_by(ItineraryDay.day_number)
            .all()
        )
        for d in rows:
            d_date = base_date + timedelta(days=d.day_number - 1) if base_date else None
            activities = d.activities if isinstance(d.activities, list) else None
            days.append(TripDay(
                day_number=d.day_number,
                date=d_date,
                title=d.title,
                subtitle=d.subtitle,
                city=d.city,
                description=d.description,
                hotel=d.hotel,
                hotel_category=d.hotel_category,
                meal_plan=d.meal_plan,
                travel_time=d.travel_time,
                distance_km=d.distance_km,
                activities=activities,
                image_url=d.image_url,
            ))

    # Hotline contact (from env fallback)
    hotline = os.getenv("STOURS_HOTLINE_PHONE", "+212 6 00 00 00 00")
    contacts = [
        TripContact(label="Hotline 24/7", phone=hotline,
                    whatsapp=hotline.replace(" ", "").lstrip("+")),
    ]

    notices: list[str] = []
    today = date.today()
    if base_date:
        delta = (base_date - today).days
        if 0 < delta <= 7:
            notices.append(f"Votre voyage commence dans {delta} jour(s) — pensez à confirmer votre vol.")
        if delta == 0:
            notices.append("Bienvenue ! Votre chauffeur vous attendra à l'arrivée avec une pancarte STOURS.")

    return TripPublicView(
        project_id=project.id,
        title=project.name,
        client_name=getattr(project, "client_name", None),
        start_date=getattr(project, "start_date", None),
        end_date=getattr(project, "end_date", None),
        branding=branding,
        days=days,
        contacts=contacts,
        notices=notices,
    )


@public_router.get("/{token}", response_model=TripPublicView)
def view_trip(
    token: str,
    pin: Optional[str] = None,
    db: Session = Depends(get_db),
):
    link = _resolve_link_or_404(token, db, pin)
    touch_link(db, link)
    return _trip_view_for_link(db, link)


@public_router.post("/{token}/messages", response_model=TravelMessageOut, status_code=201)
async def post_message(
    token: str,
    payload: TravelMessageCreate,
    pin: Optional[str] = None,
    db: Session = Depends(get_db),
):
    link = _resolve_link_or_404(token, db, pin)
    kind = payload.kind if payload.kind in ("message", "complaint", "request") else "message"
    msg = TravelMessage(
        company_id=link.company_id,
        project_id=link.project_id,
        travel_link_id=link.id,
        kind=kind,
        body=payload.body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Resolve the client display name from the project, then notify the agency.
    project = db.query(Project).filter(Project.id == link.project_id).first()
    client_label = (getattr(project, "client_name", None) or "Client").strip() or "Client"
    kind_label = {"message": "Message", "complaint": "Réclamation", "request": "Demande"}.get(kind, "Message")
    audiences = ["travel_designer"]
    if kind == "complaint":
        audiences.append("admins")
    await dispatch_to_project(
        db=db,
        project_id=link.project_id,
        audiences=audiences,
        sender_name=client_label,
        notif_type="companion_message",
        title=f"{kind_label} — Travel Companion",
        message=payload.body[:200],
        extra={"travel_message_id": msg.id, "kind": kind, "travel_link_id": link.id},
    )
    return msg
