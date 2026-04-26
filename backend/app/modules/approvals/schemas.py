"""Approval Workflow — Pydantic schemas."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.modules.approvals.models import ApprovalMode, ApprovalStatus


# ── Rules ──────────────────────────────────────────────────────────

class ApprovalRuleBase(BaseModel):
    name: str
    entity_type: str
    is_active: bool = True
    conditions: Optional[dict[str, Any]] = None
    mode: ApprovalMode = ApprovalMode.sequential
    approvers: list[dict[str, Any]] = Field(default_factory=list)
    sla_hours: Optional[int] = None


class ApprovalRuleCreate(ApprovalRuleBase):
    pass


class ApprovalRuleUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    conditions: Optional[dict[str, Any]] = None
    mode: Optional[ApprovalMode] = None
    approvers: Optional[list[dict[str, Any]]] = None
    sla_hours: Optional[int] = None


class ApprovalRuleOut(ApprovalRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    created_at: datetime
    updated_at: datetime


# ── Requests ───────────────────────────────────────────────────────

class ApprovalStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    request_id: str
    position: int
    approver_role: Optional[str] = None
    approver_user_id: Optional[str] = None
    status: ApprovalStatus
    decided_at: Optional[str] = None
    decided_by: Optional[str] = None
    comment: Optional[str] = None


class ApprovalRequestCreate(BaseModel):
    entity_type: str
    entity_id: str
    snapshot: dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None


class ApprovalDecision(BaseModel):
    comment: Optional[str] = None


class ApprovalRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    rule_id: Optional[str] = None
    entity_type: str
    entity_id: str
    submitted_by: str
    status: ApprovalStatus
    snapshot: Optional[dict[str, Any]] = None
    note: Optional[str] = None
    steps: list[ApprovalStepOut] = []
    created_at: datetime
    updated_at: datetime
