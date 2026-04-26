"""Finance router — Endpoints for profitability analysis and simulation."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.finance.service import FinanceService

router = APIRouter(prefix="/finance", tags=["finance"], dependencies=[Depends(require_auth)])

@router.get("/summary")
def get_finance_summary(db: Session = Depends(get_db)):
    """Global P&L summary for the agency."""
    service = FinanceService(db)
    return service.get_performance_summary()

@router.get("/simulate-discount")
def simulate_discount(
    project_id: str, 
    discount_pct: float = Query(..., gt=0, lt=100),
    db: Session = Depends(get_db)
):
    """Calculate potential impact of a discount on a specific project."""
    service = FinanceService(db)
    return service.simulate_discount(project_id, discount_pct)

from app.modules.finance.analytics_service import AnalyticsService

@router.get("/analytics/executive")
def get_executive_bi(db: Session = Depends(get_db)):
    """High-level BI metrics for executives."""
    service = AnalyticsService(db)
    return service.get_executive_summary()

@router.get("/analytics/ai-briefing")
def get_ai_briefing(db: Session = Depends(get_db)):
    """Strategic AI summary of business performance."""
    service = AnalyticsService(db)
    return {"briefing": service.get_ai_briefing()}
