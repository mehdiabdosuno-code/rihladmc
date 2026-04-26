"""Notifications — SSE stream (Redis pub/sub + in-memory fallback) + CRUD."""

import asyncio
import json
import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.notifications.models import Notification
from app.modules.notifications.service import get_queue, CHANNEL_PREFIX

logger = logging.getLogger("rihla.notifications")

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(require_auth)])


def _unread_payload(n: Notification) -> dict:
    return {
        "id": n.id, "type": n.type, "title": n.title,
        "message": n.message, "sender_name": n.sender_name,
        "project_id": n.project_id,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/stream")
async def notification_stream(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    """SSE endpoint — uses Redis pub/sub when available, falls back to in-memory queue."""
    user_id = current_user["sub"]

    unread = db.execute(
        select(Notification)
        .where(Notification.recipient_id == user_id, Notification.is_read == False)
        .order_by(Notification.created_at.desc())
        .limit(20)
    ).scalars().all()

    async def _redis_stream():
        from app.core.redis import get_redis
        r = await get_redis()
        if not r:
            return
        channel = f"{CHANNEL_PREFIX}{user_id}"
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)
        try:
            for n in reversed(unread):
                yield f"data: {json.dumps(_unread_payload(n))}\n\n"
            async for message in pubsub.listen():
                if await request.is_disconnected():
                    break
                if message.get("type") == "message":
                    yield f"data: {message['data']}\n\n"
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
            except Exception:
                pass

    async def _memory_stream():
        queue = get_queue(user_id)
        for n in reversed(unread):
            yield f"data: {json.dumps(_unread_payload(n))}\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=25.0)
                yield f"data: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"

    async def event_generator():
        from app.core.redis import get_redis
        r = await get_redis()
        if r:
            async for chunk in _redis_stream():
                yield chunk
        else:
            async for chunk in _memory_stream():
                yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/")
def list_notifications(db: Session = Depends(get_db), current_user: dict = Depends(require_auth)):
    return db.execute(
        select(Notification)
        .where(Notification.recipient_id == current_user["sub"])
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).scalars().all()


@router.patch("/{notif_id}/read")
def mark_read(notif_id: str, db: Session = Depends(get_db)):
    n = db.get(Notification, notif_id)
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: dict = Depends(require_auth)):
    rows = db.execute(
        select(Notification)
        .where(Notification.recipient_id == current_user["sub"], Notification.is_read == False)
    ).scalars().all()
    for n in rows:
        n.is_read = True
    db.commit()
    return {"marked": len(rows)}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: dict = Depends(require_auth)):
    count = db.execute(
        select(func.count(Notification.id))
        .where(Notification.recipient_id == current_user["sub"], Notification.is_read == False)
    ).scalar_one()
    return {"count": count}
