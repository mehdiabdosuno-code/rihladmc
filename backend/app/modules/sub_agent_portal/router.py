"""Sub-agent B2B Portal — endpoints scoped to the logged-in sub-agent.

All endpoints require:
  - a valid JWT
  - the user must have role=SUB_AGENT *and* a sub_agent_partner_id set.

Pricing / margin data is NEVER returned by these endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.auth.models import User, RoleEnum
from app.modules.master_data.models import Partner
from app.modules.projects.models import Project, ProjectStatus
from app.modules.sub_agent_portal.schemas import (
    PortalCatalogItem, PortalIdentity, PortalProject, PortalQuoteRequest,
)
from app.modules.sub_agent_portal.service import (
    get_identity, list_catalog, list_projects,
)


router = APIRouter(prefix="/portal", tags=["sub-agent-portal"])


def require_sub_agent(user: User = Depends(require_auth)) -> User:
    """Gate every portal endpoint behind role + sub_agent linkage."""
    role_name = user.role.name if user.role else None
    role_str = str(role_name.value if hasattr(role_name, "value") else role_name)
    if role_str != RoleEnum.SUB_AGENT.value:
        raise HTTPException(status_code=403, detail="Accès portail B2B uniquement")
    if not user.sub_agent_partner_id:
        raise HTTPException(status_code=403, detail="Compte non rattaché à un sous-agent")
    return user


@router.get("/me", response_model=PortalIdentity)
def me(user: User = Depends(require_sub_agent), db: Session = Depends(get_db)):
    identity = get_identity(db, user)
    if not identity:
        raise HTTPException(status_code=404, detail="Profil sous-agent introuvable")
    return identity


@router.get("/projects", response_model=list[PortalProject])
def projects(user: User = Depends(require_sub_agent), db: Session = Depends(get_db)):
    return list_projects(db, user)


@router.get("/catalog", response_model=list[PortalCatalogItem])
def catalog(user: User = Depends(require_sub_agent), db: Session = Depends(get_db)):
    return list_catalog(db, user)


@router.post("/quote-requests", response_model=PortalProject, status_code=201)
def create_quote_request(
    payload: PortalQuoteRequest,
    user: User = Depends(require_sub_agent),
    db: Session = Depends(get_db),
):
    """Sub-agent submits a request that becomes a Project draft for the agency."""
    partner = db.query(Partner).filter(Partner.id == user.sub_agent_partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Sous-agent introuvable")

    proj = Project(
        name=f"Demande {partner.name} — {payload.client_name}",
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_country=payload.client_country,
        destination=payload.destination,
        pax_count=payload.pax_count,
        duration_days=payload.duration_days,
        travel_dates=payload.travel_dates,
        notes=payload.notes,
        status=ProjectStatus.DRAFT,
        sub_agent_partner_id=partner.id,
    )
    if hasattr(Project, "company_id"):
        proj.company_id = partner.company_id
    db.add(proj); db.commit(); db.refresh(proj)
    return PortalProject(
        id=proj.id, name=proj.name, reference=proj.reference,
        client_name=proj.client_name, destination=proj.destination,
        pax_count=proj.pax_count, duration_days=proj.duration_days,
        travel_dates=proj.travel_dates,
        status=str(proj.status.value if hasattr(proj.status, "value") else proj.status),
        created_at=proj.created_at,
    )
