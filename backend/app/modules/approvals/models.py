"""Approval Workflow — configurable multi-step approval chains.

Concepts:
  ApprovalRule    — declarative rule: "for X entities matching Y, route to Z approvers"
  ApprovalRequest — instance of a rule for a specific entity (quotation, invoice, contract…)
  ApprovalStep    — one step of the request (one approver, sequential or parallel)

Conditions are stored as JSON (NOT eval) and evaluated by a safe rules engine.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import (
    String, Boolean, ForeignKey, JSON, Integer, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class ApprovalMode(str, Enum):
    sequential = "sequential"
    parallel = "parallel"


class ApprovalRule(Base, BaseMixin):
    __tablename__ = "approval_rules"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    entity_type: Mapped[str] = mapped_column(String(50), index=True)  # quotation|invoice|contract|...
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # JSON condition tree, e.g. {"all": [{"field": "total", "op": "gt", "value": 50000}]}
    # See approvals.engine.matches_conditions() for safe evaluator.
    conditions: Mapped[Optional[dict]] = mapped_column(JSON)

    mode: Mapped[ApprovalMode] = mapped_column(String(16), default=ApprovalMode.sequential)
    # Ordered list of approvers: [{"role": "sales_director"}, {"user_id": "..."}, ...]
    approvers: Mapped[list] = mapped_column(JSON, default=list)
    sla_hours: Mapped[Optional[int]] = mapped_column(Integer)

    __table_args__ = (
        Index("idx_approval_rule_company_entity", "company_id", "entity_type"),
    )


class ApprovalRequest(Base, BaseMixin):
    __tablename__ = "approval_requests"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    rule_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("approval_rules.id", ondelete="SET NULL"),
    )
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(36), index=True)

    submitted_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    status: Mapped[ApprovalStatus] = mapped_column(String(16), default=ApprovalStatus.pending, index=True)
    snapshot: Mapped[Optional[dict]] = mapped_column(JSON)  # entity values at submission time
    note: Mapped[Optional[str]] = mapped_column(String(2000))

    steps: Mapped[list["ApprovalStep"]] = relationship(
        "ApprovalStep", back_populates="request",
        cascade="all, delete-orphan", order_by="ApprovalStep.position",
    )

    __table_args__ = (
        Index("idx_approval_req_entity", "entity_type", "entity_id"),
        Index("idx_approval_req_status", "company_id", "status"),
    )


class ApprovalStep(Base, BaseMixin):
    __tablename__ = "approval_steps"

    request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("approval_requests.id", ondelete="CASCADE"), index=True,
    )
    position: Mapped[int] = mapped_column(Integer, default=0, index=True)
    approver_role: Mapped[Optional[str]] = mapped_column(String(50))
    approver_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"),
    )
    status: Mapped[ApprovalStatus] = mapped_column(String(16), default=ApprovalStatus.pending)
    decided_at: Mapped[Optional[str]] = mapped_column(String(40))  # ISO timestamp
    decided_by: Mapped[Optional[str]] = mapped_column(String(36))
    comment: Mapped[Optional[str]] = mapped_column(String(2000))

    request: Mapped[ApprovalRequest] = relationship("ApprovalRequest", back_populates="steps")
