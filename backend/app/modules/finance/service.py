"""Financial analytics module — Margin analysis, currency risk, and discount simulation."""

from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Dict

from app.modules.projects.models import Project, ProjectStatus
from app.modules.quotations.models import Quotation

class FinanceService:
    def __init__(self, db: Session):
        self.db = db

    def get_performance_summary(self) -> Dict:
        """Calculate global P&L metrics across all projects."""
        projects = self.db.execute(select(Project)).scalars().all()
        
        total_rev = 0.0
        total_cost = 0.0
        won_count = 0
        
        for p in projects:
            # We take the latest quotation for each project
            q = self.db.execute(
                select(Quotation)
                .where(Quotation.project_id == p.id)
                .order_by(Quotation.created_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            
            if q:
                total_rev += float(q.total_selling or 0)
                total_cost += float(q.price_per_pax or 0) * (p.pax_count or 1)
                if p.status == ProjectStatus.WON:
                    won_count += 1
        
        margin = total_rev - total_cost
        margin_pct = (margin / total_rev * 100) if total_rev > 0 else 0
        
        return {
            "total_revenue": total_rev,
            "total_cost": total_cost,
            "total_margin": margin,
            "margin_percentage": round(margin_pct, 2),
            "projects_count": len(projects),
            "won_count": won_count
        }

    def simulate_discount(self, project_id: str, discount_pct: float) -> Dict:
        """Simulate the impact of a discount on a specific project's margin."""
        q = self.db.execute(
            select(Quotation)
            .where(Quotation.project_id == project_id)
            .order_by(Quotation.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        
        if not q:
            return {"error": "No quotation found for this project"}
            
        original_selling = float(q.total_selling)
        original_margin = original_selling - (float(q.price_per_pax or 0) * (q.project.pax_count or 1))
        
        new_selling = original_selling * (1 - (discount_pct / 100))
        new_margin = new_selling - (float(q.price_per_pax or 0) * (q.project.pax_count or 1))
        
        return {
            "project_name": q.project.name,
            "original_selling": original_selling,
            "original_margin": original_margin,
            "new_selling": new_selling,
            "new_margin": new_margin,
            "margin_drop_pct": round(((original_margin - new_margin) / original_margin * 100), 2) if original_margin > 0 else 100
        }
