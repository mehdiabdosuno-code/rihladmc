"""Approval Workflow router."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth, require_role
from app.modules.approvals.models import (
    ApprovalRequest,
    ApprovalRule,
    ApprovalStatus,
)
from app.modules.approvals.schemas import (
    ApprovalDecision,
    ApprovalRequestCreate,
    ApprovalRequestOut,
    ApprovalRuleCreate,
    ApprovalRuleOut,
    ApprovalRuleUpdate,
)
from app.modules.approvals.service import (
    approve_step,
    cancel_request,
    reject_step,
    submit_for_approval,
)


rules_router = APIRouter(prefix="/approval-rules", tags=["approvals"])
requests_router = APIRouter(prefix="/approvals", tags=["approvals"])


# ── Rules CRUD (admin only) ────────────────────────────────────────

@rules_router.get("", response_model=list[ApprovalRuleOut])
def list_rules(
    entity_type: Optional[str] = Query(None),
    _=Depends(require_role("super_admin", "director")),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(ApprovalRule).filter(ApprovalRule.company_id == company_id)
    if entity_type:
        q = q.filter(ApprovalRule.entity_type == entity_type)
    return q.order_by(ApprovalRule.created_at.desc()).all()


@rules_router.post("", response_model=ApprovalRuleOut, status_code=201)
def create_rule(
    payload: ApprovalRuleCreate,
    _=Depends(require_role("super_admin", "director")),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    rule = ApprovalRule(**payload.model_dump(), company_id=company_id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@rules_router.patch("/{rule_id}", response_model=ApprovalRuleOut)
def update_rule(
    rule_id: str,
    payload: ApprovalRuleUpdate,
    _=Depends(require_role("super_admin", "director")),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    rule = (
        db.query(ApprovalRule)
        .filter(ApprovalRule.id == rule_id, ApprovalRule.company_id == company_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Règle introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


# ── Requests ───────────────────────────────────────────────────────

@requests_router.get("", response_model=list[ApprovalRequestOut])
def list_requests(
    status: Optional[ApprovalStatus] = Query(None),
    entity_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(ApprovalRequest).filter(ApprovalRequest.company_id == company_id)
    if status:
        q = q.filter(ApprovalRequest.status == status)
    if entity_type:
        q = q.filter(ApprovalRequest.entity_type == entity_type)
    return q.order_by(ApprovalRequest.created_at.desc()).offset(skip).limit(limit).all()


@requests_router.post("", response_model=ApprovalRequestOut, status_code=201)
def submit(
    payload: ApprovalRequestCreate,
    current=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return submit_for_approval(
        db,
        company_id=company_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        submitted_by=current["sub"],
        snapshot=payload.snapshot,
        note=payload.note,
    )


@requests_router.get("/{request_id}", response_model=ApprovalRequestOut)
def get_request(
    request_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    req = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id, ApprovalRequest.company_id == company_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return req


@requests_router.post("/{request_id}/approve", response_model=ApprovalRequestOut)
def approve(
    request_id: str,
    payload: ApprovalDecision,
    current=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    try:
        req = approve_step(
            db, request_id, current["sub"], current.get("role"), payload.comment,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if req.company_id != company_id:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return req


@requests_router.post("/{request_id}/reject", response_model=ApprovalRequestOut)
def reject(
    request_id: str,
    payload: ApprovalDecision,
    current=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    try:
        req = reject_step(
            db, request_id, current["sub"], current.get("role"), payload.comment,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if req.company_id != company_id:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return req


@requests_router.post("/{request_id}/cancel", response_model=ApprovalRequestOut)
def cancel(
    request_id: str,
    current=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    try:
        req = cancel_request(db, request_id, current["sub"])
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if req.company_id != company_id:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return req
