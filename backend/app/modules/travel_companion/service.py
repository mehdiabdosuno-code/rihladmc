"""Travel Companion — services."""

import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.travel_companion.models import TravelLink


def generate_token() -> str:
    """48-char URL-safe token (~287 bits) — un-guessable."""
    return secrets.token_urlsafe(36)


def create_link(
    db: Session,
    company_id: str,
    project_id: str,
    expires_at: Optional[datetime] = None,
    pin: Optional[str] = None,
    locale: str = "fr",
) -> TravelLink:
    link = TravelLink(
        company_id=company_id,
        project_id=project_id,
        token=generate_token(),
        pin=pin,
        expires_at=expires_at,
        locale=locale,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def get_active_link(db: Session, token: str) -> Optional[TravelLink]:
    link = db.execute(
        select(TravelLink).where(TravelLink.token == token)
    ).scalar_one_or_none()
    if not link or link.revoked:
        return None
    if link.expires_at and link.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return link


def touch_link(db: Session, link: TravelLink) -> None:
    link.last_seen_at = datetime.now(timezone.utc)
    link.open_count = (link.open_count or 0) + 1
    db.add(link)
    db.commit()


def revoke_link(db: Session, link: TravelLink) -> TravelLink:
    link.revoked = True
    db.add(link)
    db.commit()
    db.refresh(link)
    return link
