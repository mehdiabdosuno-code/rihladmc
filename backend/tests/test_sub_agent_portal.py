"""Sub-agent B2B Portal — service-level tests."""

import pytest

from app.modules.auth.models import User, Role, RoleEnum
from app.modules.companies.models import Company
from app.modules.master_data.models import Partner, PartnerType
from app.modules.projects.models import Project, ProjectStatus
from app.modules.sub_agent_portal.service import (
    get_identity, list_catalog, list_projects,
)


@pytest.fixture
def company(db) -> Company:
    c = Company(code="STOURS", name="STOURS VOYAGES", currency="MAD")
    db.add(c); db.commit(); db.refresh(c)
    return c


@pytest.fixture
def sub_agent_role(db) -> Role:
    r = Role(name=RoleEnum.SUB_AGENT, description="B2B")
    db.add(r); db.commit(); db.refresh(r)
    return r


@pytest.fixture
def reseller(db, company) -> Partner:
    p = Partner(
        company_id=company.id, code="TO-DE", name="MarrakechTours DE",
        type=PartnerType.sub_agent,
        address={
            "branding": {
                "brand_name": "MarrakechTours",
                "primary_color": "#7c3aed",
                "logo_url": "https://example.com/logo.png",
            },
        },
    )
    db.add(p); db.commit(); db.refresh(p)
    return p


@pytest.fixture
def sa_user(db, sub_agent_role, reseller) -> User:
    u = User(
        email="b2b@partner.de",
        password_hash="hash",
        full_name="Hans B.",
        role_id=sub_agent_role.id,
        sub_agent_partner_id=reseller.id,
    )
    db.add(u); db.commit(); db.refresh(u)
    u.role = sub_agent_role
    return u


def test_get_identity_returns_branded_partner(db, sa_user):
    ident = get_identity(db, sa_user)
    assert ident is not None
    assert ident.partner_name == "MarrakechTours DE"
    assert ident.branding.company_name == "MarrakechTours"
    assert ident.branding.primary_color == "#7c3aed"
    assert ident.branding.hide_costs is True


def test_get_identity_none_when_not_linked(db, sub_agent_role):
    user = User(email="x@x.fr", password_hash="h", role_id=sub_agent_role.id)
    db.add(user); db.commit()
    user.role = sub_agent_role
    assert get_identity(db, user) is None


def test_list_projects_filters_by_sub_agent(db, sa_user, reseller, company):
    own = Project(
        name="Own deal", status=ProjectStatus.IN_PROGRESS,
        sub_agent_partner_id=reseller.id,
    )
    other = Project(name="Direct sale", status=ProjectStatus.IN_PROGRESS)
    if hasattr(Project, "company_id"):
        own.company_id = company.id
        other.company_id = company.id
    db.add_all([own, other]); db.commit()

    rows = list_projects(db, sa_user)
    names = {p.name for p in rows}
    assert "Own deal" in names
    assert "Direct sale" not in names


def test_list_catalog_only_returns_validated_templates(db, sa_user, company):
    template = Project(
        name="Atlas Discovery 7d", status=ProjectStatus.VALIDATED,
        destination="Atlas", duration_days=7, currency="EUR",
        tags={"template": True},
        highlights=["Aït Ben Haddou", "Ouzoud"],
    )
    in_progress = Project(
        name="Custom 5d", status=ProjectStatus.IN_PROGRESS,
        tags={"template": True},
    )
    not_template = Project(
        name="Validated but not template", status=ProjectStatus.VALIDATED,
    )
    if hasattr(Project, "company_id"):
        template.company_id = company.id
        in_progress.company_id = company.id
        not_template.company_id = company.id
    db.add_all([template, in_progress, not_template]); db.commit()

    items = list_catalog(db, sa_user)
    names = {i.name for i in items}
    assert "Atlas Discovery 7d" in names
    assert "Custom 5d" not in names
    assert "Validated but not template" not in names
