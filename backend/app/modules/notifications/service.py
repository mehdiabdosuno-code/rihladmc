"""Notifications service — persiste en base + pousse via Redis pub/sub (fallback in-memory).

Public API
==========
- ``dispatch_notification(db, recipient_ids, ...)`` — fan-out à une liste explicite
  d'utilisateurs. À privilégier pour atteindre TD + guides + admins en une fois.
- ``dispatch_to_project(db, project_id, audiences, ...)`` — résout des audiences
  symboliques (``"travel_designer"``, ``"guides"``, ``"admins"``) en user_ids
  puis appelle ``dispatch_notification``.
- ``push_notification(db, project_id, ...)`` — alias rétro-compatible qui cible
  uniquement le travel designer du projet (comportement historique).
"""

import asyncio
import json
import logging
from typing import Iterable, Optional, Sequence
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.notifications.models import Notification

logger = logging.getLogger("rihla.notifications")

# Fallback in-memory queues when Redis is unavailable (clé = user_id)
_queues: dict[str, asyncio.Queue] = {}

CHANNEL_PREFIX = "notif:"

AudienceTag = str  # "travel_designer" | "guides" | "admins"


def get_queue(user_id: str) -> asyncio.Queue:
    if user_id not in _queues:
        _queues[user_id] = asyncio.Queue(maxsize=100)
    return _queues[user_id]


# ── Audience resolution ───────────────────────────────────────────────────────

def _find_travel_designer(db: Session, project_id: str) -> Optional[str]:
    from app.modules.projects.models import Project
    project = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    return getattr(project, "created_by", None) if project else None


def _find_assigned_guides(db: Session, project_id: str) -> list[str]:
    """user_ids of guides/drivers assigned to the project via FieldTask."""
    try:
        from app.modules.field_ops.models import FieldTask
    except Exception:
        return []
    rows = db.execute(
        select(FieldTask.staff_id).where(FieldTask.project_id == project_id).distinct()
    ).scalars().all()
    return [r for r in rows if r]


def _find_admins(db: Session) -> list[str]:
    """user_ids of super_admins / directors — used for high-severity events."""
    try:
        from app.modules.auth.models import User, Role, RoleEnum
    except Exception:
        return []
    rows = db.execute(
        select(User.id)
        .join(Role, Role.id == User.role_id)
        .where(Role.name.in_([RoleEnum.SUPER_ADMIN, RoleEnum.DIRECTOR, RoleEnum.SALES_DIRECTOR]))
        .where(User.is_active == True)  # noqa: E712
    ).scalars().all()
    return list(rows)


def _resolve_audience(db: Session, project_id: Optional[str], tag: AudienceTag) -> list[str]:
    if tag == "travel_designer" and project_id:
        td = _find_travel_designer(db, project_id)
        return [td] if td else []
    if tag == "guides" and project_id:
        return _find_assigned_guides(db, project_id)
    if tag == "admins":
        return _find_admins(db)
    return []


# ── Core dispatch ─────────────────────────────────────────────────────────────

async def dispatch_notification(
    db: Session,
    recipient_ids: Iterable[str],
    sender_name: str,
    notif_type: str,
    title: str,
    message: str,
    project_id: Optional[str] = None,
    extra: Optional[dict] = None,
) -> list[Notification]:
    """Persist one Notification per recipient and fan-out via Redis / in-memory.

    Deduplicates recipient_ids and skips empty values. Returns the persisted rows.
    """
    unique_recipients = {r for r in recipient_ids if r}
    if not unique_recipients:
        return []

    persisted: list[Notification] = []
    for rid in unique_recipients:
        notif = Notification(
            recipient_id=rid,
            project_id=project_id,
            sender_name=sender_name,
            type=notif_type,
            title=title,
            message=message,
            extra=extra,
        )
        db.add(notif)
        persisted.append(notif)
    db.commit()
    for n in persisted:
        db.refresh(n)

    from app.core.redis import get_redis
    r = await get_redis()

    for n in persisted:
        payload = {
            "id":          n.id,
            "type":        notif_type,
            "title":       title,
            "message":     message,
            "sender_name": sender_name,
            "project_id":  project_id,
            "created_at":  n.created_at.isoformat() if n.created_at else None,
        }
        payload_json = json.dumps(payload)

        delivered = False
        if r:
            try:
                await r.publish(f"{CHANNEL_PREFIX}{n.recipient_id}", payload_json)
                delivered = True
            except Exception as exc:
                logger.warning("Redis publish failed (%s), using in-memory fallback", exc)

        if not delivered:
            q = get_queue(n.recipient_id)
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                logger.debug("In-memory queue full for user %s — notification dropped", n.recipient_id)

    return persisted


async def dispatch_to_project(
    db: Session,
    project_id: str,
    audiences: Sequence[AudienceTag],
    sender_name: str,
    notif_type: str,
    title: str,
    message: str,
    extra: Optional[dict] = None,
    extra_recipient_ids: Optional[Iterable[str]] = None,
) -> list[Notification]:
    """Resolve symbolic audiences for ``project_id`` then dispatch.

    ``audiences`` accepts any combination of ``"travel_designer"``, ``"guides"``,
    ``"admins"``. ``extra_recipient_ids`` adds explicit user_ids on top.
    """
    recipients: set[str] = set(extra_recipient_ids or ())
    for tag in audiences:
        for uid in _resolve_audience(db, project_id, tag):
            recipients.add(uid)
    return await dispatch_notification(
        db=db,
        recipient_ids=recipients,
        sender_name=sender_name,
        notif_type=notif_type,
        title=title,
        message=message,
        project_id=project_id,
        extra=extra,
    )


# ── Backward-compatible alias ─────────────────────────────────────────────────

async def push_notification(
    db: Session,
    project_id: str,
    sender_name: str,
    notif_type: str,
    title: str,
    message: str,
    extra: Optional[dict] = None,
) -> None:
    """Legacy single-target API: notifies the travel designer of ``project_id``.

    Prefer :func:`dispatch_to_project` for new call sites — it can target the
    guide / admins / explicit user lists in one go.
    """
    await dispatch_to_project(
        db=db,
        project_id=project_id,
        audiences=("travel_designer",),
        sender_name=sender_name,
        notif_type=notif_type,
        title=title,
        message=message,
        extra=extra,
    )
