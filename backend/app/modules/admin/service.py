"""Admin service — Logic for auditing and management."""

import logging
from typing import Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.admin.models import AuditLog, AuditAction

logger = logging.getLogger("rihla.admin")

class AdminService:
    def __init__(self, db: Session):
        self.db = db

    def log_action(
        self,
        user_id: Optional[str | UUID],
        action: AuditAction,
        entity_type: str,
        entity_id: str,
        changes: Optional[dict] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """Create an audit log entry."""
        log = AuditLog(
            user_id=str(user_id) if user_id else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            changes=changes,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(log)
        try:
            self.db.commit()
            self.db.refresh(log)
            return log
        except Exception as e:
            logger.error(f"Failed to save audit log: {e}")
            self.db.rollback()
            raise
