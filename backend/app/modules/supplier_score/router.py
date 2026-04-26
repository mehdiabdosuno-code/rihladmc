"""Supplier Performance Score — router."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.master_data.models import Partner
from app.modules.supplier_score.models import SupplierIncident, SupplierScoreSnapshot
from app.modules.supplier_score.schemas import (
    SupplierIncidentCreate, SupplierIncidentOut,
    SupplierScoreOut, SupplierScoreSnapshotOut,
)
from app.modules.supplier_score.service import (
    calculate_score, list_supplier_scores, snapshot_today,
)


router = APIRouter(prefix="/supplier-scores", tags=["supplier-scores"])


def _get_partner_or_404(db: Session, partner_id: str, company_id: str) -> Partner:
    p = (
        db.query(Partner)
        .filter(Partner.id == partner_id, Partner.company_id == company_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return p


@router.get("", response_model=list[SupplierScoreOut])
def list_scores(
    period_days: int = Query(180, ge=30, le=720),
    only_suppliers: bool = True,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return list_supplier_scores(db, company_id, only_suppliers, period_days)


@router.get("/{partner_id}", response_model=SupplierScoreOut)
def get_score(
    partner_id: str,
    period_days: int = Query(180, ge=30, le=720),
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    partner = _get_partner_or_404(db, partner_id, company_id)
    return calculate_score(db, partner, period_days)


@router.post("/{partner_id}/snapshot", response_model=SupplierScoreSnapshotOut, status_code=201)
def take_snapshot(
    partner_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    partner = _get_partner_or_404(db, partner_id, company_id)
    return snapshot_today(db, partner)


@router.get("/{partner_id}/history", response_model=list[SupplierScoreSnapshotOut])
def history(
    partner_id: str,
    days: int = Query(180, ge=7, le=720),
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _get_partner_or_404(db, partner_id, company_id)
    return (
        db.query(SupplierScoreSnapshot)
        .filter(
            SupplierScoreSnapshot.partner_id == partner_id,
            SupplierScoreSnapshot.company_id == company_id,
        )
        .order_by(SupplierScoreSnapshot.snapshot_date.desc())
        .limit(days)
        .all()
    )


# ── Incidents ────────────────────────────────────────────────────

incidents_router = APIRouter(prefix="/supplier-incidents", tags=["supplier-scores"])


@incidents_router.post("", response_model=SupplierIncidentOut, status_code=201)
def create_incident(
    payload: SupplierIncidentCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    _get_partner_or_404(db, payload.partner_id, company_id)
    inc = SupplierIncident(
        company_id=company_id,
        partner_id=payload.partner_id,
        project_id=payload.project_id,
        severity=payload.severity,
        kind=payload.kind,
        description=payload.description,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
    )
    db.add(inc); db.commit(); db.refresh(inc)
    return inc


@incidents_router.get("", response_model=list[SupplierIncidentOut])
def list_incidents(
    partner_id: Optional[str] = None,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(SupplierIncident).filter(SupplierIncident.company_id == company_id)
    if partner_id:
        q = q.filter(SupplierIncident.partner_id == partner_id)
    return q.order_by(SupplierIncident.occurred_at.desc()).limit(200).all()


@incidents_router.post("/{incident_id}/resolve", response_model=SupplierIncidentOut)
def resolve_incident(
    incident_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    inc = (
        db.query(SupplierIncident)
        .filter(SupplierIncident.id == incident_id, SupplierIncident.company_id == company_id)
        .first()
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    inc.resolved_at = datetime.now(timezone.utc)
    db.add(inc); db.commit(); db.refresh(inc)
    return inc
