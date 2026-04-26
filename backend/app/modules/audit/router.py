"""Audit trail router — read-only access to change history."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.admin.models import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_auth)])


@router.get("/{entity_type}/{entity_id}")
def get_entity_history(
    entity_type: str,
    entity_id: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """Return full change history for a given entity (project, quotation, itinerary)."""
    rows = db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "action": r.description or r.action.value,
            "user_id": r.user_id,
            "changes": r.changes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/user/{user_id}")
def get_user_activity(
    user_id: str,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Return last N actions performed by a given user."""
    rows = db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "action": r.description or r.action.value,
            "changes": r.changes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
