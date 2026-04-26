"""Sub-agent B2B Portal — services."""

from typing import Optional
from sqlalchemy.orm import Session

from app.modules.master_data.models import Partner
from app.modules.projects.models import Project, ProjectStatus
from app.modules.auth.models import User
from app.modules.sub_agent_portal.schemas import (
    PortalBranding, PortalIdentity, PortalProject, PortalCatalogItem,
)


def _read_branding(partner: Partner) -> PortalBranding:
    """Branding lives in Partner.address.branding (JSON sub-blob)."""
    addr = getattr(partner, "address", None) or {}
    brand = (addr.get("branding") if isinstance(addr, dict) else {}) or {}
    return PortalBranding(
        company_name=brand.get("brand_name") or partner.name,
        logo_url=brand.get("logo_url"),
        primary_color=brand.get("primary_color") or "#3730a3",
        secondary_color=brand.get("secondary_color"),
        welcome_message=brand.get("welcome_message"),
        hide_costs=bool(brand.get("hide_costs", True)),
    )


def get_identity(db: Session, user: User) -> Optional[PortalIdentity]:
    if not user.sub_agent_partner_id:
        return None
    partner = db.query(Partner).filter(Partner.id == user.sub_agent_partner_id).first()
    if not partner:
        return None
    return PortalIdentity(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        partner_id=partner.id,
        partner_name=partner.name,
        branding=_read_branding(partner),
        company_id=partner.company_id,
    )


def list_projects(db: Session, user: User) -> list[PortalProject]:
    """List ONLY projects attributed to the sub-agent. No cost / margin data."""
    if not user.sub_agent_partner_id:
        return []
    rows = (
        db.query(Project)
        .filter(Project.sub_agent_partner_id == user.sub_agent_partner_id)
        .order_by(Project.created_at.desc())
        .limit(500)
        .all()
    )
    out: list[PortalProject] = []
    for p in rows:
        out.append(PortalProject(
            id=p.id, name=p.name, reference=p.reference,
            client_name=p.client_name, destination=p.destination,
            pax_count=p.pax_count, duration_days=p.duration_days,
            travel_dates=p.travel_dates,
            status=str(p.status.value if hasattr(p.status, "value") else p.status),
            created_at=p.created_at,
        ))
    return out


def list_catalog(db: Session, user: User) -> list[PortalCatalogItem]:
    """Catalog = projects of the agency flagged as templates (status=VALIDATED).

    A real implementation may use a dedicated `catalog_circuits` table; for the
    MVP we expose validated projects belonging to the agency tenant marked as
    templates via Project.tags.template = true.
    """
    if not user.sub_agent_partner_id:
        return []
    partner = db.query(Partner).filter(Partner.id == user.sub_agent_partner_id).first()
    if not partner:
        return []
    rows = (
        db.query(Project)
        .filter(Project.status == ProjectStatus.VALIDATED.value if hasattr(ProjectStatus.VALIDATED, "value") else ProjectStatus.VALIDATED)
        .order_by(Project.created_at.desc())
        .limit(200)
        .all()
        if hasattr(Project, "company_id") is False else
        db.query(Project)
        .filter(Project.company_id == partner.company_id)
        .filter(Project.status == ProjectStatus.VALIDATED.value if hasattr(ProjectStatus.VALIDATED, "value") else ProjectStatus.VALIDATED)
        .order_by(Project.created_at.desc())
        .limit(200)
        .all()
    )

    items: list[PortalCatalogItem] = []
    for p in rows:
        tags = p.tags or {}
        # Only show projects explicitly flagged as catalog templates.
        if not isinstance(tags, dict) or not tags.get("template"):
            continue
        highlights = p.highlights if isinstance(p.highlights, list) else []
        items.append(PortalCatalogItem(
            id=p.id, name=p.name,
            destination=p.destination, duration_days=p.duration_days,
            pax_count=p.pax_count, cover_image_url=p.cover_image_url,
            highlights=highlights[:5],
            currency=p.currency or "EUR",
        ))
    return items
