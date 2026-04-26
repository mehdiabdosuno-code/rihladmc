"""Live Operations Cockpit — read-only aggregator endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.ops_cockpit.schemas import OpsCockpitSnapshot
from app.modules.ops_cockpit.service import build_snapshot


router = APIRouter(prefix="/ops-cockpit", tags=["ops-cockpit"])


@router.get("", response_model=OpsCockpitSnapshot)
def cockpit_snapshot(
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    """Single endpoint that powers the live ops dashboard.

    Frontend can poll this every 15-30s, or upgrade to WebSocket later.
    """
    return build_snapshot(db, company_id)
