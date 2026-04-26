"""Approval Workflow — business logic."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.approvals.engine import matches_conditions
from app.modules.approvals.models import (
    ApprovalMode,
    ApprovalRequest,
    ApprovalRule,
    ApprovalStatus,
    ApprovalStep,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_matching_rule(
    db: Session, company_id: str, entity_type: str, snapshot: dict,
) -> Optional[ApprovalRule]:
    """Return the first active rule for {company, entity_type} whose
    conditions match the snapshot."""
    rules = (
        db.execute(
            select(ApprovalRule).where(
                ApprovalRule.company_id == company_id,
                ApprovalRule.entity_type == entity_type,
                ApprovalRule.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    for r in rules:
        if matches_conditions(r.conditions, snapshot):
            return r
    return None


def submit_for_approval(
    db: Session,
    company_id: str,
    entity_type: str,
    entity_id: str,
    submitted_by: str,
    snapshot: dict,
    note: Optional[str] = None,
) -> ApprovalRequest:
    """Create an ApprovalRequest with steps derived from the matching rule.

    If no rule matches, the request is auto-approved (no steps required).
    """
    rule = find_matching_rule(db, company_id, entity_type, snapshot)

    req = ApprovalRequest(
        company_id=company_id,
        rule_id=rule.id if rule else None,
        entity_type=entity_type,
        entity_id=entity_id,
        submitted_by=submitted_by,
        snapshot=snapshot,
        note=note,
        status=ApprovalStatus.pending,
    )
    db.add(req)
    db.flush()

    if not rule or not rule.approvers:
        # Auto-approve when no rule applies or no approvers configured.
        req.status = ApprovalStatus.approved
        db.commit()
        db.refresh(req)
        return req

    for idx, approver in enumerate(rule.approvers):
        step = ApprovalStep(
            request_id=req.id,
            position=idx,
            approver_role=approver.get("role"),
            approver_user_id=approver.get("user_id"),
            status=ApprovalStatus.pending,
        )
        db.add(step)
    db.commit()
    db.refresh(req)
    return req


def _can_act_on_step(step: ApprovalStep, user_id: str, user_role: Optional[str]) -> bool:
    if step.approver_user_id and step.approver_user_id == user_id:
        return True
    if step.approver_role and user_role and step.approver_role == user_role:
        return True
    return False


def _next_actionable_steps(req: ApprovalRequest, mode: ApprovalMode) -> list[ApprovalStep]:
    pending = [s for s in req.steps if s.status == ApprovalStatus.pending]
    if not pending:
        return []
    if mode == ApprovalMode.parallel:
        return pending
    # sequential: only the lowest position
    pending.sort(key=lambda s: s.position)
    return [pending[0]]


def approve_step(
    db: Session,
    request_id: str,
    user_id: str,
    user_role: Optional[str],
    comment: Optional[str] = None,
) -> ApprovalRequest:
    req = db.get(ApprovalRequest, request_id)
    if not req:
        raise ValueError("Demande introuvable")
    if req.status != ApprovalStatus.pending:
        raise ValueError("Demande déjà clôturée")
    rule = db.get(ApprovalRule, req.rule_id) if req.rule_id else None
    mode = rule.mode if rule else ApprovalMode.sequential

    actionable = _next_actionable_steps(req, mode)
    target = next((s for s in actionable if _can_act_on_step(s, user_id, user_role)), None)
    if not target:
        raise PermissionError("Vous n'êtes pas l'approbateur attendu pour cette étape")

    target.status = ApprovalStatus.approved
    target.decided_at = _now_iso()
    target.decided_by = user_id
    target.comment = comment
    db.add(target)

    if all(s.status == ApprovalStatus.approved for s in req.steps):
        req.status = ApprovalStatus.approved

    db.commit()
    db.refresh(req)
    return req


def reject_step(
    db: Session,
    request_id: str,
    user_id: str,
    user_role: Optional[str],
    comment: Optional[str] = None,
) -> ApprovalRequest:
    req = db.get(ApprovalRequest, request_id)
    if not req:
        raise ValueError("Demande introuvable")
    if req.status != ApprovalStatus.pending:
        raise ValueError("Demande déjà clôturée")
    rule = db.get(ApprovalRule, req.rule_id) if req.rule_id else None
    mode = rule.mode if rule else ApprovalMode.sequential

    actionable = _next_actionable_steps(req, mode)
    target = next((s for s in actionable if _can_act_on_step(s, user_id, user_role)), None)
    if not target:
        raise PermissionError("Vous n'êtes pas l'approbateur attendu pour cette étape")

    target.status = ApprovalStatus.rejected
    target.decided_at = _now_iso()
    target.decided_by = user_id
    target.comment = comment
    db.add(target)

    # Any rejection rejects the whole request
    req.status = ApprovalStatus.rejected
    db.commit()
    db.refresh(req)
    return req


def cancel_request(db: Session, request_id: str, user_id: str) -> ApprovalRequest:
    req = db.get(ApprovalRequest, request_id)
    if not req:
        raise ValueError("Demande introuvable")
    if req.submitted_by != user_id:
        raise PermissionError("Seul l'auteur peut annuler la demande")
    if req.status != ApprovalStatus.pending:
        raise ValueError("Demande déjà clôturée")
    req.status = ApprovalStatus.cancelled
    db.commit()
    db.refresh(req)
    return req
