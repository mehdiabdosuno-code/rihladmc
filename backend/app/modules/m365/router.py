"""M365 — Microsoft 365 unified integration.

Multi-account OAuth (multi Travel Designers) + Outlook Mail + SharePoint /
OneDrive Drive + Microsoft Teams notifications.

Demo mode: if `MS_CLIENT_ID` is unset or a connection is flagged is_demo,
all endpoints return rich simulated payloads so the UI is fully testable
without Azure AD configuration.
"""

from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.shared.dependencies import require_auth
from app.modules.m365.models import M365Connection, M365LinkedMessage
from app.modules.projects.models import Project
from app.modules.invoices.models import Invoice

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/m365",
    tags=["m365"],
    dependencies=[Depends(require_auth)],
)
public_router = APIRouter(prefix="/m365", tags=["m365-public"])

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPES = [
    "User.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "offline_access",
]

# CSRF state cache (in-memory; OAuth flow is short)
_STATES: dict[str, dict] = {}


# ── Helpers ──────────────────────────────────────────────────────────

def _user_id(current: dict) -> str:
    return str(current.get("sub") or current.get("user_id") or "anon")


def _is_real() -> bool:
    return bool(settings.MS_CLIENT_ID and settings.MS_CLIENT_SECRET)


def _get_or_demo_connection(db: Session, user_id: str, conn_id: Optional[str] = None) -> M365Connection:
    """Return the requested connection, falling back to a demo singleton."""
    q = db.execute(
        select(M365Connection).where(M365Connection.user_id == user_id)
    ).scalars()
    rows = list(q)
    if conn_id:
        for r in rows:
            if r.id == conn_id:
                return r
        raise HTTPException(404, "Connection not found")
    if rows:
        return rows[0]
    # Auto-provision a demo connection for this user
    demo = M365Connection(
        user_id=user_id,
        account_email="demo@stoursvoyages.ma",
        display_name="Demo · Travel Designer",
        tenant_id=settings.MS_TENANT_ID,
        scopes=" ".join(SCOPES),
        is_demo=True,
        drive_id="demo-drive",
        sharepoint_site_id="demo-site",
        payload={"created_via": "auto-demo"},
    )
    db.add(demo)
    db.commit()
    db.refresh(demo)
    return demo


# ── Schemas ──────────────────────────────────────────────────────────

class ConnectionOut(BaseModel):
    id: str
    user_id: str
    account_email: str
    display_name: Optional[str]
    tenant_id: Optional[str]
    expires_at: Optional[datetime]
    is_demo: bool
    scopes: list[str]
    drive_id: Optional[str]
    sharepoint_site_id: Optional[str]


class StatusOut(BaseModel):
    is_real: bool
    is_demo: bool
    teams_webhook_configured: bool
    sharepoint_site_configured: bool
    connections: list[ConnectionOut]


class AuthUrlOut(BaseModel):
    auth_url: str
    state: str
    is_demo: bool


class MailMessage(BaseModel):
    id: str
    subject: Optional[str]
    sender: Optional[str]
    recipients: list[str]
    received_at: datetime
    preview: Optional[str]
    direction: str
    project_id: Optional[str] = None
    invoice_id: Optional[str] = None
    is_demo: bool


class SendMailRequest(BaseModel):
    to: list[EmailStr]
    cc: Optional[list[EmailStr]] = None
    subject: str
    body: str
    project_id: Optional[str] = None
    invoice_id: Optional[str] = None


class DriveFile(BaseModel):
    id: str
    name: str
    folder: bool
    size: Optional[int] = None
    mime_type: Optional[str] = None
    web_url: Optional[str] = None
    modified_at: Optional[datetime] = None


class ProvisionFolderRequest(BaseModel):
    project_id: str


class ProvisionFolderOut(BaseModel):
    folder_path: str
    folder_id: Optional[str]
    subfolders: list[str]
    web_url: Optional[str]
    is_demo: bool


class TeamsNotifyRequest(BaseModel):
    title: str
    message: str
    color: Optional[str] = "1f6feb"
    facts: Optional[list[dict[str, str]]] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None


# ── 1. OAuth flow ────────────────────────────────────────────────────

@router.get("/status", response_model=StatusOut)
def status(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> StatusOut:
    uid = _user_id(current)
    rows = db.execute(
        select(M365Connection).where(M365Connection.user_id == uid)
    ).scalars().all()
    return StatusOut(
        is_real=_is_real(),
        is_demo=not _is_real(),
        teams_webhook_configured=bool(settings.TEAMS_WEBHOOK_URL),
        sharepoint_site_configured=bool(settings.MS_SHAREPOINT_SITE),
        connections=[
            ConnectionOut(
                id=r.id,
                user_id=r.user_id,
                account_email=r.account_email,
                display_name=r.display_name,
                tenant_id=r.tenant_id,
                expires_at=r.expires_at,
                is_demo=r.is_demo,
                scopes=(r.scopes or "").split() if r.scopes else [],
                drive_id=r.drive_id,
                sharepoint_site_id=r.sharepoint_site_id,
            )
            for r in rows
        ],
    )


@router.post("/oauth/start", response_model=AuthUrlOut)
def oauth_start(current: dict = Depends(get_current_user)) -> AuthUrlOut:
    uid = _user_id(current)
    state = secrets.token_urlsafe(24)
    _STATES[state] = {"user_id": uid, "issued_at": datetime.now(timezone.utc).isoformat()}
    if not _is_real():
        return AuthUrlOut(
            auth_url=f"/api/m365/oauth/demo-callback?state={state}",
            state=state,
            is_demo=True,
        )
    params = {
        "client_id": settings.MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": " ".join(SCOPES),
        "state": state,
        "prompt": "select_account",
    }
    base = f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}/oauth2/v2.0/authorize"
    return AuthUrlOut(auth_url=f"{base}?{urlencode(params)}", state=state, is_demo=False)


@public_router.get("/oauth/demo-callback")
def demo_callback(state: str, db: Session = Depends(get_db)):
    """Demo OAuth landing — stores a fake connection in DB, no real token exchange."""
    s = _STATES.pop(state, None)
    if not s:
        raise HTTPException(400, "Invalid state")
    uid = s["user_id"]
    fake = M365Connection(
        user_id=uid,
        account_email=f"travel.designer.{uid[:6]}@stoursvoyages.ma",
        display_name="Travel Designer (demo)",
        tenant_id=settings.MS_TENANT_ID,
        scopes=" ".join(SCOPES),
        access_token="demo-access-token",
        refresh_token="demo-refresh-token",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        drive_id="demo-drive",
        sharepoint_site_id="demo-site",
        is_demo=True,
    )
    db.add(fake)
    db.commit()
    return RedirectResponse(f"{settings.APP_BASE_URL}/m365?connected=demo")


@public_router.get("/oauth/callback")
def real_callback(
    state: str,
    code: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{settings.APP_BASE_URL}/m365?error={error}")
    s = _STATES.pop(state, None)
    if not s or not code:
        raise HTTPException(400, "Invalid state or missing code")

    try:
        import httpx  # type: ignore
    except ImportError:
        raise HTTPException(500, "httpx not installed")

    token_url = f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}/oauth2/v2.0/token"
    payload = {
        "client_id": settings.MS_CLIENT_ID,
        "client_secret": settings.MS_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.MS_REDIRECT_URI,
        "scope": " ".join(SCOPES),
    }
    try:
        r = httpx.post(token_url, data=payload, timeout=30.0)
        r.raise_for_status()
        tok = r.json()
        # who am I?
        me = httpx.get(f"{GRAPH}/me",
                       headers={"Authorization": f"Bearer {tok['access_token']}"},
                       timeout=15.0).json()
    except Exception as e:
        logger.exception("M365 token exchange failed")
        return RedirectResponse(f"{settings.APP_BASE_URL}/m365?error=token-exchange")

    conn = M365Connection(
        user_id=s["user_id"],
        account_email=me.get("mail") or me.get("userPrincipalName") or "unknown@m365",
        display_name=me.get("displayName"),
        tenant_id=settings.MS_TENANT_ID,
        scopes=" ".join(SCOPES),
        access_token=tok.get("access_token"),
        refresh_token=tok.get("refresh_token"),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in") or 3600)),
        is_demo=False,
        payload={"me": me},
    )
    db.add(conn)
    db.commit()
    return RedirectResponse(f"{settings.APP_BASE_URL}/m365?connected=1")


@router.delete("/connections/{conn_id}")
def disconnect(
    conn_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> dict:
    uid = _user_id(current)
    conn = db.get(M365Connection, conn_id)
    if not conn or conn.user_id != uid:
        raise HTTPException(404, "Not found")
    db.delete(conn)
    db.commit()
    return {"ok": True}


# ── 2. Outlook Mail ──────────────────────────────────────────────────

_DEMO_INBOX = [
    {
        "id": "demo-msg-1",
        "subject": "Re: Devis QUO-2026-0042 — Ajustements hôtels Marrakech",
        "sender": "sophie.martin@bluepearltours.com",
        "recipients": ["a.chakir@stoursvoyages.ma"],
        "preview": "Bonjour Abdelwahed, merci pour la proposition. Pourriez-vous confirmer la disponibilité du Royal Mansour pour les 12-16 mai ?",
        "direction": "in",
        "hours_ago": 1.5,
        "match": "QUO-2026-0042",
    },
    {
        "id": "demo-msg-2",
        "subject": "RIHLA · Confirmation paiement INV-DEMO-001",
        "sender": "noreply@stripe.com",
        "recipients": ["finance@stoursvoyages.ma"],
        "preview": "Vous avez reçu un paiement de 4 320,00 EUR. Référence : pi_3O7XYZ...",
        "direction": "in",
        "hours_ago": 4,
        "match": "INV-DEMO-001",
    },
    {
        "id": "demo-msg-3",
        "subject": "Brief opérations — Discovery Tangier-Chefchaouen",
        "sender": "a.chakir@stoursvoyages.ma",
        "recipients": ["ops@stoursvoyages.ma", "guide.youssef@stoursvoyages.ma"],
        "preview": "Voir ci-joint le rooming list final + heures d'arrivée transferts. Tour Imperial Cities décalé de J+1 (annulation vol AT771).",
        "direction": "out",
        "hours_ago": 26,
        "match": None,
    },
    {
        "id": "demo-msg-4",
        "subject": "Demande FIT couple — 8 jours luxe Sahara fin septembre",
        "sender": "contact@vipholidays.fr",
        "recipients": ["a.chakir@stoursvoyages.ma"],
        "preview": "Bonjour, nouveau client FIT, couple 55-60 ans, budget premium ouvert, 8 jours fin septembre 2026, Sahara + Marrakech, suite avec terrasse...",
        "direction": "in",
        "hours_ago": 48,
        "match": None,
    },
    {
        "id": "demo-msg-5",
        "subject": "Facture fournisseur — Royal Mansour mai 2026",
        "sender": "comptabilite@royalmansour.com",
        "recipients": ["finance@stoursvoyages.ma"],
        "preview": "PJ : facture #2026-318 pour groupe Discovery Tangier-Chefchaouen, montant 28 400 EUR, échéance 30j.",
        "direction": "in",
        "hours_ago": 72,
        "match": "Discovery",
    },
]


def _demo_mail_for(folder: str = "inbox") -> list[dict]:
    return [m for m in _DEMO_INBOX if (folder == "sent") == (m["direction"] == "out")] \
        if folder in ("inbox", "sent") else _DEMO_INBOX


def _autolink(text: str, db: Session) -> dict[str, Optional[str]]:
    """Find INV-/QUO- refs and project name matches."""
    out: dict[str, Optional[str]] = {"project_id": None, "invoice_id": None}
    if not text:
        return out
    inv_match = re.search(r"INV-[\w\d-]+", text, re.IGNORECASE)
    if inv_match:
        inv = db.execute(
            select(Invoice).where(Invoice.number == inv_match.group(0))
        ).scalars().first()
        if inv:
            out["invoice_id"] = inv.id
            if hasattr(inv, "project_id"):
                out["project_id"] = inv.project_id
    if not out["project_id"]:
        # Heuristic: scan first 6 words for known project names
        names = db.execute(select(Project.id, Project.name)).all()
        lower = text.lower()
        for pid, nm in names:
            if nm and len(nm) > 4 and nm.lower() in lower:
                out["project_id"] = pid
                break
    return out


@router.get("/mail/inbox", response_model=list[MailMessage])
def mail_inbox(
    folder: str = Query("inbox", pattern="^(inbox|sent)$"),
    project_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> list[MailMessage]:
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)

    out: list[MailMessage] = []
    if conn.is_demo:
        for m in _demo_mail_for(folder):
            received = datetime.now(timezone.utc) - timedelta(hours=m["hours_ago"])
            link_target = m.get("preview") or m.get("subject") or ""
            links = _autolink(f"{m.get('subject','')} {link_target}", db)
            if project_id and links["project_id"] != project_id and m.get("match") != project_id:
                continue
            if invoice_id and links["invoice_id"] != invoice_id:
                continue
            out.append(MailMessage(
                id=m["id"], subject=m["subject"], sender=m["sender"],
                recipients=m["recipients"], received_at=received,
                preview=m["preview"], direction=m["direction"],
                project_id=links["project_id"], invoice_id=links["invoice_id"],
                is_demo=True,
            ))
        return out[:limit]

    # Real Microsoft Graph fetch
    try:
        import httpx  # type: ignore
        endpoint = f"{GRAPH}/me/{'mailFolders/sentItems/messages' if folder == 'sent' else 'messages'}"
        params = {"$top": str(limit), "$select": "id,subject,from,toRecipients,bodyPreview,receivedDateTime"}
        r = httpx.get(endpoint, params=params, timeout=20.0,
                      headers={"Authorization": f"Bearer {conn.access_token}"})
        r.raise_for_status()
        data = r.json().get("value", [])
        for m in data:
            sender = (m.get("from") or {}).get("emailAddress", {}).get("address", "")
            recips = [(r.get("emailAddress") or {}).get("address", "")
                      for r in (m.get("toRecipients") or [])]
            text = f"{m.get('subject','')} {m.get('bodyPreview','')}"
            links = _autolink(text, db)
            if project_id and links["project_id"] != project_id:
                continue
            if invoice_id and links["invoice_id"] != invoice_id:
                continue
            out.append(MailMessage(
                id=m["id"], subject=m.get("subject"), sender=sender,
                recipients=recips, received_at=m.get("receivedDateTime"),
                preview=m.get("bodyPreview"),
                direction=("out" if folder == "sent" else "in"),
                project_id=links["project_id"], invoice_id=links["invoice_id"],
                is_demo=False,
            ))
        return out
    except Exception as e:
        logger.warning("Graph mail fetch failed: %s", e)
        return []


@router.post("/mail/send")
def mail_send(
    req: SendMailRequest,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> dict:
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)
    if conn.is_demo:
        # Persist a record for the timeline
        msg = M365LinkedMessage(
            connection_id=conn.id,
            project_id=req.project_id,
            invoice_id=req.invoice_id,
            message_id=f"demo-out-{secrets.token_hex(4)}",
            subject=req.subject,
            sender=conn.account_email,
            recipients=", ".join(req.to),
            preview=req.body[:300],
            direction="out",
            received_at=datetime.now(timezone.utc),
            payload={"cc": req.cc, "demo": True},
        )
        db.add(msg)
        db.commit()
        return {"status": "simulated", "message_id": msg.message_id, "is_demo": True}

    try:
        import httpx  # type: ignore
        body = {
            "message": {
                "subject": req.subject,
                "body": {"contentType": "HTML", "content": req.body},
                "toRecipients": [{"emailAddress": {"address": e}} for e in req.to],
                "ccRecipients": [{"emailAddress": {"address": e}} for e in (req.cc or [])],
            },
            "saveToSentItems": "true",
        }
        r = httpx.post(f"{GRAPH}/me/sendMail", json=body, timeout=20.0,
                       headers={"Authorization": f"Bearer {conn.access_token}"})
        r.raise_for_status()
        return {"status": "sent", "is_demo": False}
    except Exception as e:
        logger.exception("Graph sendMail failed")
        raise HTTPException(502, f"Send failed: {e}")


@router.get("/mail/timeline/{project_id}", response_model=list[MailMessage])
def mail_timeline(
    project_id: str,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> list[MailMessage]:
    """Combined timeline for a project (cached + live)."""
    return mail_inbox(folder="inbox", project_id=project_id, db=db, current=current) + \
           mail_inbox(folder="sent",  project_id=project_id, db=db, current=current)


# ── 3. SharePoint / OneDrive ─────────────────────────────────────────

_DEFAULT_SUBFOLDERS = ["Devis", "Contrats", "Factures", "Vouchers", "Photos client"]


@router.post("/drive/provision-folder", response_model=ProvisionFolderOut)
def drive_provision(
    req: ProvisionFolderRequest,
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> ProvisionFolderOut:
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)
    project = db.get(Project, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    folder_name = re.sub(r"[^\w\d -]", "", project.name or "Projet")[:80]
    folder_path = f"/RIHLA/Dossiers/{folder_name}"

    if conn.is_demo or not settings.MS_SHAREPOINT_SITE:
        return ProvisionFolderOut(
            folder_path=folder_path,
            folder_id=f"demo-{project.id}",
            subfolders=_DEFAULT_SUBFOLDERS,
            web_url=f"https://stoursvoyages.sharepoint.com/sites/RIHLA{folder_path}",
            is_demo=True,
        )

    try:
        import httpx  # type: ignore
        h = {"Authorization": f"Bearer {conn.access_token}", "Content-Type": "application/json"}
        site_url = f"{GRAPH}/sites/{settings.MS_SHAREPOINT_SITE}"
        site = httpx.get(site_url, headers=h, timeout=15.0).json()
        site_id = site.get("id")
        drive = httpx.get(f"{GRAPH}/sites/{site_id}/drive", headers=h, timeout=15.0).json()
        drive_id = drive.get("id")
        # Ensure parent path
        for part in ["RIHLA", "Dossiers", folder_name]:
            httpx.post(
                f"{GRAPH}/drives/{drive_id}/root:/RIHLA/Dossiers/{folder_name}:/children",
                json={"name": part, "folder": {}, "@microsoft.graph.conflictBehavior": "ignore"},
                headers=h, timeout=15.0,
            )
        for sub in _DEFAULT_SUBFOLDERS:
            httpx.post(
                f"{GRAPH}/drives/{drive_id}/root:/RIHLA/Dossiers/{folder_name}/{sub}:/children",
                json={"name": sub, "folder": {}, "@microsoft.graph.conflictBehavior": "ignore"},
                headers=h, timeout=15.0,
            )
        return ProvisionFolderOut(
            folder_path=folder_path, folder_id=drive_id,
            subfolders=_DEFAULT_SUBFOLDERS,
            web_url=site.get("webUrl"),
            is_demo=False,
        )
    except Exception as e:
        logger.exception("SharePoint provision failed")
        raise HTTPException(502, str(e))


_DEMO_DRIVE_FILES = {
    "/RIHLA/Dossiers/Discovery Tangier-Chefchaouen": [
        {"name": "Devis", "folder": True, "size": None},
        {"name": "Contrats", "folder": True, "size": None},
        {"name": "Factures", "folder": True, "size": None},
        {"name": "Vouchers", "folder": True, "size": None},
        {"name": "Photos client", "folder": True, "size": None},
        {"name": "Brief client.docx", "folder": False, "size": 28400, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        {"name": "Itinerary v2.pdf", "folder": False, "size": 412900, "mime_type": "application/pdf"},
    ],
    "/RIHLA/Dossiers/Discovery Tangier-Chefchaouen/Devis": [
        {"name": "QUO-2026-0042-v1.pdf", "folder": False, "size": 318200, "mime_type": "application/pdf"},
        {"name": "QUO-2026-0042-v2.pdf", "folder": False, "size": 326800, "mime_type": "application/pdf"},
    ],
    "/RIHLA/Dossiers/Discovery Tangier-Chefchaouen/Vouchers": [
        {"name": "Voucher-Royal-Mansour.pdf", "folder": False, "size": 91200, "mime_type": "application/pdf"},
        {"name": "Voucher-Transfert-CMN.pdf", "folder": False, "size": 64500, "mime_type": "application/pdf"},
    ],
}


@router.get("/drive/list", response_model=list[DriveFile])
def drive_list(
    path: str = Query("/RIHLA/Dossiers"),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> list[DriveFile]:
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)
    if conn.is_demo:
        items = _DEMO_DRIVE_FILES.get(path)
        if items is None:
            # Fallback: list known top-level folders
            items = [{"name": "Discovery Tangier-Chefchaouen", "folder": True, "size": None},
                     {"name": "FIT Family Marrakech", "folder": True, "size": None},
                     {"name": "Luxury Sahara Experience", "folder": True, "size": None}]
        now = datetime.now(timezone.utc)
        return [
            DriveFile(
                id=f"demo-{path}-{i}", name=it["name"], folder=it["folder"],
                size=it.get("size"), mime_type=it.get("mime_type"),
                web_url=f"https://stoursvoyages.sharepoint.com{path}/{it['name']}",
                modified_at=now - timedelta(hours=i + 1),
            )
            for i, it in enumerate(items)
        ]

    try:
        import httpx  # type: ignore
        h = {"Authorization": f"Bearer {conn.access_token}"}
        if conn.drive_id:
            r = httpx.get(f"{GRAPH}/drives/{conn.drive_id}/root:{path}:/children",
                          headers=h, timeout=20.0)
        else:
            r = httpx.get(f"{GRAPH}/me/drive/root:{path}:/children",
                          headers=h, timeout=20.0)
        r.raise_for_status()
        items = r.json().get("value", [])
        return [
            DriveFile(
                id=it["id"], name=it["name"],
                folder=bool(it.get("folder")),
                size=it.get("size"),
                mime_type=(it.get("file") or {}).get("mimeType"),
                web_url=it.get("webUrl"),
                modified_at=it.get("lastModifiedDateTime"),
            )
            for it in items
        ]
    except Exception as e:
        logger.warning("Drive list failed: %s", e)
        return []


@router.post("/drive/upload")
async def drive_upload(
    path: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> dict:
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)
    content = await file.read()
    if conn.is_demo:
        return {
            "status": "simulated",
            "name": file.filename,
            "size": len(content),
            "path": f"{path}/{file.filename}",
            "is_demo": True,
            "web_url": f"https://stoursvoyages.sharepoint.com{path}/{file.filename}",
        }

    try:
        import httpx  # type: ignore
        h = {"Authorization": f"Bearer {conn.access_token}",
             "Content-Type": file.content_type or "application/octet-stream"}
        url = f"{GRAPH}/drives/{conn.drive_id}/root:{path}/{file.filename}:/content"
        r = httpx.put(url, headers=h, content=content, timeout=60.0)
        r.raise_for_status()
        meta = r.json()
        return {"status": "uploaded", "id": meta.get("id"), "web_url": meta.get("webUrl"),
                "size": meta.get("size"), "is_demo": False}
    except Exception as e:
        logger.exception("Drive upload failed")
        raise HTTPException(502, str(e))


# ── 4. Microsoft Teams ───────────────────────────────────────────────

@router.post("/teams/notify")
def teams_notify(req: TeamsNotifyRequest) -> dict:
    """Post a card to the configured Teams channel via incoming webhook.

    In demo mode we just log the payload and return status='simulated'.
    """
    card = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": (req.color or "1f6feb").lstrip("#"),
        "summary": req.title,
        "title": req.title,
        "text": req.message,
        "sections": [{"facts": req.facts or []}] if req.facts else [],
        "potentialAction": (
            [{"@type": "OpenUri", "name": req.action_label or "Ouvrir",
              "targets": [{"os": "default", "uri": req.action_url}]}]
            if req.action_url else []
        ),
    }

    if not settings.TEAMS_WEBHOOK_URL:
        logger.info("[Teams demo] %s — %s", req.title, req.message)
        return {"status": "simulated", "is_demo": True, "card": card}

    try:
        import httpx  # type: ignore
        r = httpx.post(settings.TEAMS_WEBHOOK_URL, json=card, timeout=15.0)
        r.raise_for_status()
        return {"status": "sent", "is_demo": False}
    except Exception as e:
        logger.exception("Teams webhook failed")
        raise HTTPException(502, str(e))


# ── 5. Aggregated dashboard ──────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Single endpoint feeding the M365 hub UI."""
    uid = _user_id(current)
    conn = _get_or_demo_connection(db, uid)
    inbox = mail_inbox(folder="inbox", db=db, current=current)
    sent = mail_inbox(folder="sent", db=db, current=current)
    return {
        "connection": ConnectionOut(
            id=conn.id, user_id=conn.user_id, account_email=conn.account_email,
            display_name=conn.display_name, tenant_id=conn.tenant_id,
            expires_at=conn.expires_at, is_demo=conn.is_demo,
            scopes=(conn.scopes or "").split() if conn.scopes else [],
            drive_id=conn.drive_id, sharepoint_site_id=conn.sharepoint_site_id,
        ),
        "inbox_unread": sum(1 for m in inbox if m.direction == "in"),
        "linked_inbox": [m for m in inbox if m.project_id or m.invoice_id],
        "recent_inbox": inbox[:5],
        "recent_sent": sent[:3],
        "drive_root": drive_list(path="/RIHLA/Dossiers", db=db, current=current),
        "teams_configured": bool(settings.TEAMS_WEBHOOK_URL),
        "sharepoint_configured": bool(settings.MS_SHAREPOINT_SITE),
        "is_real": _is_real(),
    }
