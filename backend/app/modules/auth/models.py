"""Authentication and authorization models."""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Boolean, ForeignKey, Table, Column, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class RoleEnum(str, Enum):
    """Enum of all available roles in the system."""

    SUPER_ADMIN = "super_admin"
    SALES_DIRECTOR = "sales_director"
    TRAVEL_DESIGNER = "travel_designer"
    QUOTATION_OFFICER = "quotation_officer"
    DATA_OPERATOR = "data_operator"
    SALES_AGENT = "sales_agent"
    GUIDE = "guide"
    CLIENT = "client"
    DRIVER = "driver"
    TRANSPORT_MANAGER = "transport_manager"
    DIRECTOR = "director"
    SUB_AGENT = "sub_agent"   # B2B revendeur (white-label portal)


# Junction table for many-to-many relationship
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", String(36), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Permission(Base, BaseMixin):
    """Permission model for RBAC."""

    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    module: Mapped[str] = mapped_column(String(100), comment="Module this permission belongs to")

    roles: Mapped[list["Role"]] = relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions",
        cascade="all",
    )

    __table_args__ = (Index("idx_permission_module", "module"),)


class Role(Base, BaseMixin):
    """Role model for RBAC."""

    __tablename__ = "roles"

    name: Mapped[RoleEnum] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    permissions_json: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="Cached permissions as JSON for faster lookups"
    )

    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="role",
        cascade="all, delete-orphan",
    )
    permissions: Mapped[list[Permission]] = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
        cascade="all",
    )


class User(Base, BaseMixin):
    """User model for authentication."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id", ondelete="RESTRICT"))

    # Optional link to a Partner — used when this user is a sub-agent / B2B reseller.
    sub_agent_partner_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    role: Mapped[Role] = relationship("Role", back_populates="users")

    __table_args__ = (
        Index("idx_user_email_active", "email", "is_active"),
        Index("idx_user_role_id", "role_id"),
    )
