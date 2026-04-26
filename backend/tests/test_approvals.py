"""Approval Workflow — unit tests."""

import pytest
from sqlalchemy.orm import Session

from app.modules.companies.models import Company
from app.modules.approvals.engine import matches_conditions
from app.modules.approvals.models import (
    ApprovalMode,
    ApprovalRule,
    ApprovalStatus,
)
from app.modules.approvals.service import (
    approve_step,
    cancel_request,
    reject_step,
    submit_for_approval,
)


# ── Engine ─────────────────────────────────────────────────────────

def test_engine_eq_match():
    assert matches_conditions({"field": "status", "op": "eq", "value": "draft"},
                              {"status": "draft"})

def test_engine_gt_match():
    assert matches_conditions({"field": "total", "op": "gt", "value": 1000},
                              {"total": 1500})

def test_engine_gt_no_match():
    assert not matches_conditions({"field": "total", "op": "gt", "value": 1000},
                                  {"total": 500})

def test_engine_all():
    cond = {"all": [
        {"field": "total", "op": "gt", "value": 1000},
        {"field": "status", "op": "eq", "value": "draft"},
    ]}
    assert matches_conditions(cond, {"total": 1500, "status": "draft"})
    assert not matches_conditions(cond, {"total": 500, "status": "draft"})

def test_engine_any():
    cond = {"any": [
        {"field": "total", "op": "gt", "value": 50000},
        {"field": "vip", "op": "eq", "value": True},
    ]}
    assert matches_conditions(cond, {"total": 1000, "vip": True})

def test_engine_not():
    cond = {"not": {"field": "status", "op": "eq", "value": "draft"}}
    assert matches_conditions(cond, {"status": "submitted"})
    assert not matches_conditions(cond, {"status": "draft"})

def test_engine_none_matches_everything():
    assert matches_conditions(None, {"anything": "goes"})

def test_engine_unknown_op_fails_safely():
    assert not matches_conditions({"field": "x", "op": "exec", "value": "y"}, {"x": "y"})


# ── Service ────────────────────────────────────────────────────────

@pytest.fixture
def company(db: Session) -> Company:
    c = Company(code="STOURS", name="STOURS VOYAGES", currency="MAD")
    db.add(c); db.commit(); db.refresh(c)
    return c


def test_submit_creates_request_with_no_rule_auto_approves(db: Session, company: Company):
    req = submit_for_approval(
        db, company.id, "quotation", entity_id="q-1",
        submitted_by="u-1", snapshot={"total_selling": 100},
    )
    assert req.status == ApprovalStatus.approved
    assert len(req.steps) == 0


def test_submit_with_matching_rule_creates_steps(db: Session, company: Company):
    db.add(ApprovalRule(
        company_id=company.id, name="Big quotes",
        entity_type="quotation",
        conditions={"all": [{"field": "total_selling", "op": "gt", "value": 50000}]},
        approvers=[{"role": "sales_director"}],
        mode=ApprovalMode.sequential,
    ))
    db.commit()

    req = submit_for_approval(
        db, company.id, "quotation", entity_id="q-1",
        submitted_by="u-1", snapshot={"total_selling": 100000},
    )
    assert req.status == ApprovalStatus.pending
    assert len(req.steps) == 1
    assert req.steps[0].approver_role == "sales_director"


def test_approve_full_chain_sequential(db: Session, company: Company):
    db.add(ApprovalRule(
        company_id=company.id, name="2-step",
        entity_type="quotation", conditions=None,
        approvers=[{"role": "sales_director"}, {"role": "director"}],
        mode=ApprovalMode.sequential,
    ))
    db.commit()
    req = submit_for_approval(
        db, company.id, "quotation", "q-1", "u-1", {"total_selling": 999999},
    )
    # First approver
    req = approve_step(db, req.id, "u-2", "sales_director", "ok")
    assert req.status == ApprovalStatus.pending
    assert req.steps[0].status == ApprovalStatus.approved
    assert req.steps[1].status == ApprovalStatus.pending
    # Second approver
    req = approve_step(db, req.id, "u-3", "director", "ok")
    assert req.status == ApprovalStatus.approved


def test_reject_kills_request(db: Session, company: Company):
    db.add(ApprovalRule(
        company_id=company.id, name="r", entity_type="quotation",
        conditions=None, approvers=[{"role": "sales_director"}],
        mode=ApprovalMode.sequential,
    ))
    db.commit()
    req = submit_for_approval(db, company.id, "quotation", "q-1", "u-1", {})
    req = reject_step(db, req.id, "u-2", "sales_director", "no")
    assert req.status == ApprovalStatus.rejected


def test_cancel_only_by_author(db: Session, company: Company):
    db.add(ApprovalRule(
        company_id=company.id, name="r", entity_type="quotation",
        conditions=None, approvers=[{"role": "sales_director"}],
    ))
    db.commit()
    req = submit_for_approval(db, company.id, "quotation", "q-1", "u-author", {})
    with pytest.raises(PermissionError):
        cancel_request(db, req.id, "u-other")
    req = cancel_request(db, req.id, "u-author")
    assert req.status == ApprovalStatus.cancelled


def test_wrong_approver_blocked(db: Session, company: Company):
    db.add(ApprovalRule(
        company_id=company.id, name="r", entity_type="quotation",
        conditions=None, approvers=[{"role": "sales_director"}],
    ))
    db.commit()
    req = submit_for_approval(db, company.id, "quotation", "q-1", "u-1", {})
    with pytest.raises(PermissionError):
        approve_step(db, req.id, "u-2", "sales_agent", "trying")
