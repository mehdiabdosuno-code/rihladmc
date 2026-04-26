"""Analytics Service — Business Intelligence and Executive Reporting."""

from sqlalchemy.orm import Session
from sqlalchemy import select, func, extract
from datetime import datetime
from typing import List, Dict

from app.modules.projects.models import Project, ProjectStatus
from app.modules.invoices.models import Invoice

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def get_executive_summary(self) -> Dict:
        """Calculate high-level KPIs for the executive dashboard."""
        
        # 1. Win Rate Calculation
        total_projects = self.db.query(func.count(Project.id)).scalar() or 0
        won_projects = self.db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.WON).scalar() or 0
        win_rate = (won_projects / total_projects * 100) if total_projects > 0 else 0
        
        # 2. Revenue Trends (Monthly)
        current_year = datetime.now().year
        monthly_revenue = self.db.query(
            extract('month', Invoice.created_at).label('month'),
            func.sum(Invoice.total).label('revenue')
        ).filter(extract('year', Invoice.created_at) == current_year)\
         .group_by('month')\
         .all()
        
        revenue_data = {int(m): float(r) for m, r in monthly_revenue}
        
        # 3. Top Destinations
        top_destinations = self.db.query(
            Project.destination,
            func.count(Project.id).label('count')
        ).group_by(Project.destination)\
         .order_by(func.count(Project.id).desc())\
         .limit(5)\
         .all()
        
        # 4. Conversion funnel
        funnel = {
            "draft": self.db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.DRAFT).scalar() or 0,
            "in_progress": self.db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.IN_PROGRESS).scalar() or 0,
            "won": won_projects
        }

        return {
            "win_rate": round(win_rate, 1),
            "total_projects": total_projects,
            "won_projects": won_projects,
            "revenue_by_month": revenue_data,
            "top_destinations": [{"city": d, "count": c} for d, c in top_destinations],
            "funnel": funnel,
            "last_updated": datetime.now().isoformat()
        }

    def get_ai_briefing(self) -> str:
        """
        In a real scenario, this would send data to GPT-4o to get a strategic summary.
        Here we return a structured strategic observation.
        """
        return (
            "Observation Stratégique : Le marché du luxe à Marrakech est en surchauffe. "
            "Recommandation : Diversifier vers le Nord (Chefchaouen/Tanger) où la marge brute "
            "est 12% plus élevée par PAX. Le taux de conversion des dossiers US a augmenté de 5%."
        )
