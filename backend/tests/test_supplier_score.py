"""Supplier Performance Score — unit tests."""

from datetime import datetime, timezone, timedelta

import pytest

from app.modules.companies.models import Company
from app.modules.master_data.models import Partner, PartnerType
from app.modules.reviews.models import Review, ReviewTarget
from app.modules.supplier_score.models import SupplierIncident
from app.modules.supplier_score.service import (
    calculate_score, list_supplier_scores, snapshot_today,
)


@pytest.fixture
def company(db) -> Company:
    c = Company(code="STOURS", name="STOURS VOYAGES", currency="MAD")
    db.add(c); db.commit(); db.refresh(c)
    return c


@pytest.fixture
def partner(db, company: Company) -> Partner:
    p = Partner(
        company_id=company.id,
        code="SUP-001",
        name="Riad Yasmine",
        type=PartnerType.supplier,
    )
    db.add(p); db.commit(); db.refresh(p)
    return p


def _add_review(db, partner: Partner, rating: int, project_id="proj-1", reviewer_id="user-x"):
    r = Review(
        project_id=project_id, reviewer_id=reviewer_id,
        reviewer_name="Client", target_type=ReviewTarget.HOTEL,
        target_id=partner.id, target_name=partner.name,
        rating=rating, is_public=True,
    )
    db.add(r); db.commit(); return r


def _add_incident(db, partner: Partner, severity="medium"):
    inc = SupplierIncident(
        company_id=partner.company_id,
        partner_id=partner.id,
        severity=severity, kind="late",
        description="Test incident",
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(inc); db.commit(); return inc


def test_score_no_data_uses_neutral_baseline(db, partner):
    score = calculate_score(db, partner)
    # 30 (neutral review) + 30 (no incidents) + 12 + 12 = 84
    assert score.total_score == 84
    assert score.grade == "A"
    assert score.breakdown.review_count == 0


def test_score_with_5_star_reviews(db, partner):
    for _ in range(3):
        _add_review(db, partner, 5)
    score = calculate_score(db, partner)
    # 5 * 8 = 40 review score
    assert score.breakdown.review_score == 40
    assert score.breakdown.review_count == 3
    assert score.breakdown.review_avg == 5.0
    assert score.total_score == 40 + 30 + 12 + 12  # 94
    assert score.grade == "A"


def test_score_drops_with_critical_incidents(db, partner):
    _add_incident(db, partner, "critical")
    _add_incident(db, partner, "critical")
    _add_incident(db, partner, "high")
    score = calculate_score(db, partner)
    # incident penalty = 10 + 10 + 5 = 25, base 30 → 5
    assert score.breakdown.incident_score == 5
    # 30 (no reviews) + 5 + 12 + 12 = 59
    assert score.total_score == 59
    assert score.grade == "C"   # 50..64


def test_score_overrides_via_address_blob(db, partner):
    partner.address = {"score_overrides": {"tariff_compliance": 15, "responsiveness": 15}}
    db.add(partner); db.commit()
    score = calculate_score(db, partner)
    # 30 + 30 + 15 + 15 = 90
    assert score.breakdown.tariff_score == 15
    assert score.breakdown.responsiveness_score == 15
    assert score.total_score == 90


def test_snapshot_today_persists_and_overwrites(db, partner):
    s1 = snapshot_today(db, partner)
    assert s1.total_score == 84
    s1_id, s1_score = s1.id, s1.total_score
    # Simulate change: add an incident, recompute
    _add_incident(db, partner, "critical")
    s2 = snapshot_today(db, partner)
    assert s2.id == s1_id  # same record, updated in place
    assert s2.total_score < s1_score


def test_list_scores_sorted_desc(db, company):
    a = Partner(company_id=company.id, code="A", name="Alpha", type=PartnerType.supplier)
    b = Partner(company_id=company.id, code="B", name="Bravo", type=PartnerType.supplier)
    db.add_all([a, b]); db.commit()
    _add_review(db, a, 5); _add_review(db, a, 5)   # higher score
    _add_incident(db, b, "critical"); _add_incident(db, b, "critical")
    scores = list_supplier_scores(db, company.id)
    assert [s.partner_name for s in scores][0] == "Alpha"


def test_list_scores_filters_by_company(db, company):
    other = Company(code="OTHER", name="Autre", currency="MAD")
    db.add(other); db.commit(); db.refresh(other)
    p_a = Partner(company_id=company.id, code="A", name="In-tenant", type=PartnerType.supplier)
    p_b = Partner(company_id=other.id, code="B", name="Other-tenant", type=PartnerType.supplier)
    db.add_all([p_a, p_b]); db.commit()
    scores = list_supplier_scores(db, company.id)
    names = {s.partner_name for s in scores}
    assert "In-tenant" in names
    assert "Other-tenant" not in names
