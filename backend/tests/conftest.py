"""Test configuration and shared fixtures.

Uses SQLite in-memory database for fast, isolated tests.
Every test function gets a clean database state.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.shared.models import Base
from app.modules.auth.models import User, Role, RoleEnum
from app.modules.projects.models import Project, ProjectStatus, ProjectType
from app.core.security import hash_password, create_access_token

# Ensure all models are in Base.metadata before create_all
import app.modules.proposals.models      as _pm   # noqa: F401
import app.modules.admin.models          as _am   # noqa: F401
import app.modules.itineraries.models    as _im   # noqa: F401
import app.modules.quotations.models     as _qm   # noqa: F401
import app.modules.notifications.models  as _nm   # noqa: F401
import app.modules.guides.models         as _gm   # noqa: F401
import app.modules.hotels.models         as _hm   # noqa: F401
import app.modules.reviews.models        as _rm   # noqa: F401
import app.modules.invoices.models       as _invm # noqa: F401
import app.modules.field_ops.models      as _fm   # noqa: F401
import app.modules.gamification.models   as _gam  # noqa: F401
import app.modules.guide_portal.models   as _gpm  # noqa: F401
import app.modules.menus.models          as _mm   # noqa: F401
import app.modules.transports.models     as _tm   # noqa: F401
import app.modules.references.models     as _refm # noqa: F401
import app.modules.reports.models        as _repom# noqa: F401
import app.modules.ai.models             as _aim  # noqa: F401
import app.modules.companies.models       as _cpm  # noqa: F401
import app.modules.master_data.models     as _mdm  # noqa: F401
import app.modules.contracting.models     as _ctm  # noqa: F401
import app.modules.document_flow.models   as _dfm  # noqa: F401
import app.modules.approvals.models       as _apm  # noqa: F401
import app.modules.travel_companion.models as _tcm  # noqa: F401
import app.modules.supplier_score.models  as _ssm  # noqa: F401
import app.modules.erp_integration.models as _erpm # noqa: F401

# ── In-memory SQLite engine ───────────────────────────────────────────────
SQLITE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # share single connection so create_all tables are visible
)
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture(scope="function")
def db() -> Session:
    """Fresh in-memory database per test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> TestClient:
    """TestClient with DB override injected."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_role(db: Session) -> Role:
    """Create and persist a super_admin role."""
    role = Role(name=RoleEnum.SUPER_ADMIN, description="Test admin role")
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture(scope="function")
def designer_role(db: Session) -> Role:
    """Create and persist a travel_designer role."""
    role = Role(name=RoleEnum.TRAVEL_DESIGNER, description="Test designer role")
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture(scope="function")
def admin_user(db: Session, admin_role: Role) -> User:
    """Create and persist a super_admin user."""
    user = User(
        email="admin@stours.ma",
        full_name="Admin Test",
        password_hash=hash_password("Admin1234!"),
        role_id=admin_role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def designer_user(db: Session, designer_role: Role) -> User:
    """Create and persist a travel_designer user."""
    user = User(
        email="designer@stours.ma",
        full_name="Designer Test",
        password_hash=hash_password("Design1234!"),
        role_id=designer_role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user: User) -> str:
    """JWT token for admin user."""
    return create_access_token({
        "sub": admin_user.id,
        "email": admin_user.email,
        "role": RoleEnum.SUPER_ADMIN,
    })


@pytest.fixture(scope="function")
def designer_token(designer_user: User) -> str:
    """JWT token for designer user."""
    return create_access_token({
        "sub": designer_user.id,
        "email": designer_user.email,
        "role": RoleEnum.TRAVEL_DESIGNER,
    })


@pytest.fixture(scope="function")
def auth_headers(admin_token: str) -> dict:
    """Authorization headers for admin user."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="function")
def designer_headers(designer_token: str) -> dict:
    """Authorization headers for designer user."""
    return {"Authorization": f"Bearer {designer_token}"}


@pytest.fixture(scope="function")
def sample_project(db: Session, admin_user: User) -> Project:
    """A persisted sample project."""
    project = Project(
        name="Test Circuit Maroc",
        client_name="Acme Corp",
        client_email="acme@test.com",
        status=ProjectStatus.DRAFT,
        project_type=ProjectType.LEISURE,
        destination="Marrakech",
        duration_days=7,
        duration_nights=6,
        pax_count=20,
        currency="EUR",
        created_by=admin_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
