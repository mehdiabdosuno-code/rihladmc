"""B7 — Microsoft Outlook calendar sync.

OAuth2 (auth code flow) → store access/refresh tokens → push project
events (transferts, check-ins, briefings) to user's Outlook calendar.

Demo mode (no MS_CLIENT_ID): generates simulated event previews so the
UI is fully testable.
"""

from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.core.security import get_current_user


def _user_id(current: dict) -> str:
    return str(current.get("sub") or current.get("user_id") or "anon")
from app.modules.projects.models import Project
from app.modules.itineraries.models import Itinerary, ItineraryDay

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/calendar-sync",
    tags=["calendar-sync"],
    dependencies=[Depends(require_auth)],
)
public_router = APIRouter(
    prefix="/calendar-sync",
    tags=["calendar-sync-public"],
)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["Calendars.ReadWrite", "User.Read", "offline_access"]


# In-memory token store (keyed by user_id). For production, persist to DB.
# Demo-friendly and safe across restarts via re-auth.
_TOKENS: dict[str, dict] = {}
_STATES: dict[str, dict] = {}  # csrf states for OAuth handshake


# ── Schemas ───────────────────────────────────────────────────────────

class StatusResponse(BaseModel):
    configured: bool
    connected: bool
    user_email: Optional[str] = None
    expires_at: Optional[str] = None
    is_demo: bool


class AuthUrlResponse(BaseModel):
    auth_url: str
    state: str
    is_demo: bool


class EventPreview(BaseModel):
    subject: str
    start: str
    end: str
    location: Optional[str] = None
    body: Optional[str] = None
    category: str  # transfer | check-in | briefing | activity


class PushRequest(BaseModel):
    project_id: str
    dry_run: bool = False
    categories: list[str] = Field(default_factory=lambda: ["transfer", "check-in", "briefing"])


class PushResponse(BaseModel):
    project_id: str
    is_demo: bool
    events_planned: int
    events_pushed: int
    preview: list[EventPreview]


# ── Helpers ───────────────────────────────────────────────────────────

def _msal_app():
    import msal  # type: ignore
    authority = f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}"
    return msal.ConfidentialClientApplication(
        client_id=settings.MS_CLIENT_ID,
        client_credential=settings.MS_CLIENT_SECRET,
        authority=authority,
    )


def _redirect_uri() -> str:
    base = settings.APP_BASE_URL.rstrip("/")
    return f"{base}/api/calendar-sync/oauth/callback"


def _build_events(db: Session, project: Project) -> list[EventPreview]:
    """Generate calendar events from a project's itinerary."""
    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project.id)
    ).scalars().first()
    if not itin:
        return []

    days = db.execute(
        select(ItineraryDay)
        .where(ItineraryDay.itinerary_id == itin.id)
        .order_by(ItineraryDay.day_number)
    ).scalars().all()
    if not days:
        return []

    # Anchor start date: parse project.travel_dates if possible, else today + 30
    start = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=30)
    if project.travel_dates:
        try:
            # Try ISO-like first 10 chars
            start = datetime.fromisoformat(project.travel_dates[:10]).replace(tzinfo=timezone.utc, hour=9)
        except Exception:
            pass

    events: list[EventPreview] = []
    pax = project.pax_count or 2
    for d in days:
        day_start = start + timedelta(days=d.day_number - 1)
        # check-in event at 14:00
        if d.hotel:
            ci = day_start.replace(hour=14, minute=0)
            events.append(EventPreview(
                subject=f"Check-in {d.hotel}",
                start=ci.isoformat(),
                end=(ci + timedelta(minutes=30)).isoformat(),
                location=f"{d.hotel}, {d.city or ''}".strip(", "),
                body=f"{project.name} · {pax} pax · {d.title}",
                category="check-in",
            ))
        # transfer placeholder at 09:00 if travel_time noted
        if d.day_number > 1 and getattr(d, "travel_time", None):
            tr = day_start.replace(hour=9, minute=0)
            events.append(EventPreview(
                subject=f"Transfert {d.city or ''} ({d.title})".strip(),
                start=tr.isoformat(),
                end=(tr + timedelta(hours=2)).isoformat(),
                location=d.city,
                body=f"{project.name} · transport jour {d.day_number}",
                category="transfer",
            ))
    # briefing the day before departure at 17:00
    briefing = start - timedelta(days=1)
    briefing = briefing.replace(hour=17, minute=0)
    events.append(EventPreview(
        subject=f"Briefing {project.name}",
        start=briefing.isoformat(),
        end=(briefing + timedelta(minutes=30)).isoformat(),
        location="Bureau S'TOURS",
        body=f"Récap circuit · {pax} pax · destination {project.destination or ''}",
        category="briefing",
    ))
    return events


def _filter(events: list[EventPreview], categories: list[str]) -> list[EventPreview]:
    if not categories:
        return events
    return [e for e in events if e.category in categories]


def _push_to_graph(token: str, ev: EventPreview) -> bool:
    import httpx  # type: ignore
    body = {
        "subject": ev.subject,
        "body": {"contentType": "text", "content": ev.body or ""},
        "start": {"dateTime": ev.start, "timeZone": "UTC"},
        "end": {"dateTime": ev.end, "timeZone": "UTC"},
        "location": {"displayName": ev.location or ""},
    }
    try:
        r = httpx.post(
            f"{GRAPH_BASE}/me/events",
            json=body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=15.0,
        )
        if r.status_code >= 400:
            logger.warning("Graph push failed: %s %s", r.status_code, r.text[:200])
            return False
        return True
    except Exception as e:
        logger.warning("Graph push exception: %s", e)
        return False


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusResponse)
def get_status(user=Depends(get_current_user)) -> StatusResponse:
    configured = bool(settings.MS_CLIENT_ID and settings.MS_CLIENT_SECRET)
    if not configured:
        return StatusResponse(
            configured=False, connected=False, is_demo=True,
        )
    tok = _TOKENS.get(_user_id(user))
    if not tok:
        return StatusResponse(configured=True, connected=False, is_demo=False)
    return StatusResponse(
        configured=True,
        connected=True,
        user_email=tok.get("user_email"),
        expires_at=tok.get("expires_at"),
        is_demo=False,
    )


@router.get("/oauth/start", response_model=AuthUrlResponse)
def oauth_start(user=Depends(get_current_user)) -> AuthUrlResponse:
    if not (settings.MS_CLIENT_ID and settings.MS_CLIENT_SECRET):
        # Demo: return a fake auth URL that auto-completes on callback
        state = secrets.token_urlsafe(16)
        _STATES[state] = {"user_id": _user_id(user), "demo": True}
        return AuthUrlResponse(
            auth_url=f"{settings.APP_BASE_URL}/api/calendar-sync/oauth/callback?state={state}&code=DEMO",
            state=state,
            is_demo=True,
        )
    app = _msal_app()
    state = secrets.token_urlsafe(16)
    _STATES[state] = {"user_id": _user_id(user), "demo": False}
    auth_url = app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=_redirect_uri(),
        state=state,
    )
    return AuthUrlResponse(auth_url=auth_url, state=state, is_demo=False)


@public_router.get("/oauth/callback")
def oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    if error:
        return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms_error={error}")
    if not state or state not in _STATES:
        return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms_error=invalid_state")
    info = _STATES.pop(state)
    user_id = info["user_id"]

    # Demo mode
    if info.get("demo") or not (settings.MS_CLIENT_ID and settings.MS_CLIENT_SECRET):
        _TOKENS[user_id] = {
            "access_token": "DEMO",
            "refresh_token": "DEMO",
            "user_email": "demo@stoursvoyages.ma",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        }
        return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms=demo_connected")

    if not code:
        return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms_error=missing_code")

    app = _msal_app()
    result = app.acquire_token_by_authorization_code(
        code=code, scopes=SCOPES, redirect_uri=_redirect_uri(),
    )
    if "access_token" not in result:
        logger.warning("MS token exchange failed: %s", result)
        return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms_error=token_exchange")
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=result.get("expires_in", 3600))
    _TOKENS[user_id] = {
        "access_token": result["access_token"],
        "refresh_token": result.get("refresh_token"),
        "user_email": (result.get("id_token_claims") or {}).get("preferred_username"),
        "expires_at": expires_at.isoformat(),
    }
    return RedirectResponse(f"{settings.APP_BASE_URL}/settings?ms=connected")


@router.post("/disconnect")
def disconnect(user=Depends(get_current_user)):
    _TOKENS.pop(_user_id(user), None)
    return {"disconnected": True}


@router.post("/push", response_model=PushResponse)
def push_events(body: PushRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = db.get(Project, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    events = _filter(_build_events(db, project), body.categories)

    is_demo = not (settings.MS_CLIENT_ID and settings.MS_CLIENT_SECRET)
    tok = _TOKENS.get(_user_id(user))

    pushed = 0
    if not body.dry_run and tok and not is_demo and tok.get("access_token") not in (None, "DEMO"):
        for ev in events:
            if _push_to_graph(tok["access_token"], ev):
                pushed += 1
    elif not body.dry_run and tok and tok.get("access_token") == "DEMO":
        # demo "push": just count them
        pushed = len(events)

    return PushResponse(
        project_id=project.id,
        is_demo=is_demo,
        events_planned=len(events),
        events_pushed=pushed,
        preview=events[:50],
    )


@router.get("/preview", response_model=list[EventPreview])
def preview_events(project_id: str, db: Session = Depends(get_db)) -> list[EventPreview]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _build_events(db, project)
