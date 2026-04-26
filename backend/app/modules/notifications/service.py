"""Notifications service — persiste en base + pousse via Redis pub/sub (fallback in-memory)."""

import asyncio
import json
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.notifications.models import Notification

logger = logging.getLogger("rihla.notifications")

# Fallback in-memory queues when Redis is unavailable (clé = user_id)
_queues: dict[str, asyncio.Queue] = {}

CHANNEL_PREFIX = "notif:"


def get_queue(user_id: str) -> asyncio.Queue:
    if user_id not in _queues:
        _queues[user_id] = asyncio.Queue(maxsize=100)
    return _queues[user_id]


def _find_travel_designer(db: Session, project_id: str) -> Optional[str]:
    from app.modules.projects.models import Project
    project = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if project and project.created_by:
        return project.created_by
    return None


async def push_notification(
    db: Session,
    project_id: str,
    sender_name: str,
    notif_type: str,
    title: str,
    message: str,
    extra: Optional[dict] = None,
) -> None:
    """Persist notification and fan-out to the travel designer's SSE stream."""
    recipient_id = _find_travel_designer(db, project_id)
    if not recipient_id:
        return

    notif = Notification(
        recipient_id=recipient_id,
        project_id=project_id,
        sender_name=sender_name,
        type=notif_type,
        title=title,
        message=message,
        extra=extra,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    payload = {
        "id":          notif.id,
        "type":        notif_type,
        "title":       title,
        "message":     message,
        "sender_name": sender_name,
        "project_id":  project_id,
        "created_at":  notif.created_at.isoformat() if notif.created_at else None,
    }
    payload_json = json.dumps(payload)

    # Try Redis pub/sub first
    from app.core.redis import get_redis
    r = await get_redis()
    if r:
        try:
            await r.publish(f"{CHANNEL_PREFIX}{recipient_id}", payload_json)
            logger.debug("Notification published via Redis for user %s", recipient_id)
            return
        except Exception as exc:
            logger.warning("Redis publish failed (%s), using in-memory fallback", exc)

    # In-memory fallback
    q = get_queue(recipient_id)
    try:
        q.put_nowait(payload)
    except asyncio.QueueFull:
        logger.debug("In-memory queue full for user %s — notification dropped", recipient_id)
