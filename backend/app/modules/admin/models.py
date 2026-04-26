"""Admin configuration and management models."""

from enum import Enum
from typing import Optional
from sqlalchemy import String, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class AuditAction(str, Enum):
    """Types of auditable actions."""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    DOWNLOAD = "download"
    LOGIN = "login"
    LOGOUT = "logout"


class AuditLog(Base, BaseMixin):
    """Audit trail for compliance and debugging."""

    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[AuditAction] = mapped_column(String(50), index=True)
    entity_type: Mapped[str] = mapped_column(String(100), comment="Model name (User, Project, Quotation, etc.)")
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    changes: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="Changed fields before/after"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), comment="IPv4 or IPv6")
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(String(1000))

    __table_args__ = (
        Index("idx_audit_action", "action"),
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_created", "created_at"),
    )
