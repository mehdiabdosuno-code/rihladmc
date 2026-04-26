"""Audit trail helper — wraps the existing AuditLog model for convenient mutation logging."""

from typing import Optional, Any
from sqlalchemy.orm import Session


def log_action(
    db: Session,
    entity_type: str,
    entity_id: str,
    action: str,
    current_user: dict,
    changes: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
):
    """
    Append an audit entry using the existing AuditLog model.
    Does NOT commit — caller is responsible.

    Usage:
        log_action(db, "project", project.id, "update", current_user,
                   changes={"status": {"before": "draft", "after": "sent"}})
        db.commit()
    """
    from app.modules.admin.models import AuditLog, AuditAction

    # Map string action to AuditAction enum, default to UPDATE
    action_map = {
        "create": AuditAction.CREATE,
        "update": AuditAction.UPDATE,
        "delete": AuditAction.DELETE,
        "status_change": AuditAction.UPDATE,
        "export": AuditAction.EXPORT,
    }

    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action_map.get(action, AuditAction.UPDATE),
        user_id=current_user.get("sub"),
        changes=changes,
        ip_address=ip_address,
        description=action,  # store the raw action string in description
    )
    db.add(entry)
    return entry


def diff(before: dict, after: dict) -> dict:
    """Return only changed fields as {field: {before, after}}."""
    return {
        k: {"before": before.get(k), "after": after.get(k)}
        for k in set(before) | set(after)
        if before.get(k) != after.get(k)
    }
