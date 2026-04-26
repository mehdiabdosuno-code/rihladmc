"""Document Flow router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.document_flow.schemas import FlowGraph
from app.modules.document_flow.service import build_flow

router = APIRouter(prefix="/document-flow", tags=["document-flow"])


@router.get("/projects/{project_id}", response_model=FlowGraph)
def get_project_flow(
    project_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    """Return the visual document graph for a project."""
    return build_flow(db, project_id=project_id, company_id=company_id)
