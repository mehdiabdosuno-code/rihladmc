"""Budget Tracker — Actual vs Estimated cost analysis.

Post-voyage module to:
  - Record actual costs per category
  - Compare with original quotation
  - Identify cost overruns and savings
  - Generate profitability report
  - Track trends across projects for better future quotations
"""

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation, QuotationLine
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/budget", tags=["budget-tracker"],
                   dependencies=[Depends(require_auth)])

# In-memory store (production would use a DB table)
_actuals: dict[str, dict] = {}


# ── Schemas ──────────────────────────────────────────────────────────

class ActualCostLine(BaseModel):
    category: str  # hotel, transport, guide, monument, activity, restaurant, misc
    label: str
    day_number: Optional[int] = None
    supplier: Optional[str] = None
    estimated_cost: Optional[float] = None  # Auto-filled from quotation
    actual_cost: float
    invoice_ref: Optional[str] = None
    notes: Optional[str] = None


class ActualCostsSubmit(BaseModel):
    lines: list[ActualCostLine]
    actual_pax_count: Optional[int] = None
    total_client_payment: Optional[float] = None
    notes: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/{project_id}/actuals", summary="Submit actual costs")
def submit_actuals(
    project_id: str,
    data: ActualCostsSubmit,
    db: Session = Depends(get_db),
):
    """Submit actual costs for a completed project.

    Automatically compares with the original quotation.
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Load original quotation for comparison
    quotation = db.execute(
        select(Quotation)
        .where(Quotation.project_id == project_id)
        .options(selectinload(Quotation.lines))
    ).scalars().first()

    # Build estimated by category from quotation
    estimated_by_cat: dict[str, float] = {}
    estimated_total = 0
    if quotation:
        for l in quotation.lines:
            cat = str(l.category) if l.category else "misc"
            cost = float(l.total_cost or 0)
            estimated_by_cat[cat] = estimated_by_cat.get(cat, 0) + cost
            estimated_total += cost

    # Process actuals
    actual_by_cat: dict[str, float] = {}
    actual_total = 0
    lines_data = []

    for line in data.lines:
        actual_by_cat[line.category] = actual_by_cat.get(line.category, 0) + line.actual_cost
        actual_total += line.actual_cost

        est = line.estimated_cost
        if est is None and quotation:
            # Try to match from quotation lines
            matching = [
                l for l in quotation.lines
                if str(l.category) == line.category and l.day_number == line.day_number
            ]
            if matching:
                est = float(matching[0].total_cost or 0)

        variance = line.actual_cost - (est or 0) if est else None
        variance_pct = (variance / est * 100) if est and est != 0 else None

        lines_data.append({
            **line.model_dump(),
            "estimated_cost": est,
            "variance": round(variance, 2) if variance is not None else None,
            "variance_pct": round(variance_pct, 1) if variance_pct is not None else None,
            "status": (
                "over" if variance and variance > 0
                else "under" if variance and variance < 0
                else "on_budget"
            ) if variance is not None else "no_estimate",
        })

    # Category comparison
    all_categories = set(list(estimated_by_cat.keys()) + list(actual_by_cat.keys()))
    category_comparison = []
    for cat in sorted(all_categories):
        est = estimated_by_cat.get(cat, 0)
        act = actual_by_cat.get(cat, 0)
        diff = act - est
        category_comparison.append({
            "category": cat,
            "estimated": round(est, 2),
            "actual": round(act, 2),
            "variance": round(diff, 2),
            "variance_pct": round(diff / est * 100, 1) if est else None,
            "status": "over" if diff > 0 else "under" if diff < 0 else "on_budget",
        })

    # Overall profitability
    selling_total = float(quotation.total_selling or 0) if quotation else 0
    actual_margin = selling_total - actual_total if selling_total else None
    actual_margin_pct = (actual_margin / selling_total * 100) if selling_total and actual_margin else None
    estimated_margin_pct = float(quotation.margin_pct or 0) if quotation else None

    result = {
        "project_id": project_id,
        "project_name": project.name,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "pax_count": {
            "estimated": project.pax_count,
            "actual": data.actual_pax_count or project.pax_count,
        },
        "totals": {
            "estimated_cost": round(estimated_total, 2),
            "actual_cost": round(actual_total, 2),
            "variance": round(actual_total - estimated_total, 2),
            "variance_pct": round((actual_total - estimated_total) / estimated_total * 100, 1) if estimated_total else None,
            "selling_total": round(selling_total, 2),
            "client_payment": data.total_client_payment,
        },
        "profitability": {
            "estimated_margin_pct": estimated_margin_pct,
            "actual_margin": round(actual_margin, 2) if actual_margin is not None else None,
            "actual_margin_pct": round(actual_margin_pct, 1) if actual_margin_pct is not None else None,
            "margin_variance": (
                round(actual_margin_pct - estimated_margin_pct, 1)
                if actual_margin_pct is not None and estimated_margin_pct is not None
                else None
            ),
        },
        "by_category": category_comparison,
        "lines": lines_data,
        "notes": data.notes,
    }

    # Store for retrieval
    _actuals[project_id] = result
    return result


@router.get("/{project_id}/report", summary="Get budget report")
def get_budget_report(project_id: str, db: Session = Depends(get_db)):
    """Retrieve the budget comparison report for a project."""
    if project_id not in _actuals:
        # Try to build from quotation only (no actuals yet)
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(404, "Project not found")

        quotation = db.execute(
            select(Quotation)
            .where(Quotation.project_id == project_id)
            .options(selectinload(Quotation.lines))
        ).scalars().first()

        if not quotation:
            return {
                "project_id": project_id,
                "status": "no_data",
                "message": "No quotation or actuals found. Submit actuals first.",
            }

        # Return estimated-only report
        by_cat: dict[str, float] = {}
        total = 0
        for l in quotation.lines:
            cat = str(l.category) if l.category else "misc"
            cost = float(l.total_cost or 0)
            by_cat[cat] = by_cat.get(cat, 0) + cost
            total += cost

        return {
            "project_id": project_id,
            "project_name": project.name,
            "status": "estimated_only",
            "message": "No actual costs submitted yet. Showing estimated budget.",
            "estimated_total": round(total, 2),
            "by_category": [
                {"category": cat, "estimated": round(v, 2)}
                for cat, v in sorted(by_cat.items(), key=lambda x: -x[1])
            ],
            "selling_total": round(float(quotation.total_selling or 0), 2),
            "estimated_margin_pct": float(quotation.margin_pct or 0),
        }

    return _actuals[project_id]


@router.get("/trends", summary="Budget variance trends across projects")
def budget_trends(db: Session = Depends(get_db)):
    """Analyze budget accuracy trends across all projects with actuals."""
    if not _actuals:
        return {
            "total_projects_tracked": 0,
            "message": "No budget data available. Submit actuals for completed projects.",
        }

    projects = []
    total_estimated = 0
    total_actual = 0
    category_variances: dict[str, list[float]] = {}

    for pid, report in _actuals.items():
        totals = report.get("totals", {})
        est = totals.get("estimated_cost", 0)
        act = totals.get("actual_cost", 0)
        total_estimated += est
        total_actual += act

        projects.append({
            "project_id": pid,
            "project_name": report.get("project_name", ""),
            "estimated": est,
            "actual": act,
            "variance_pct": totals.get("variance_pct"),
        })

        for cat in report.get("by_category", []):
            cat_name = cat["category"]
            if cat.get("variance_pct") is not None:
                category_variances.setdefault(cat_name, []).append(cat["variance_pct"])

    avg_category_variance = {
        cat: round(sum(vals) / len(vals), 1)
        for cat, vals in category_variances.items()
    }

    overall_variance = ((total_actual - total_estimated) / total_estimated * 100) if total_estimated else 0

    # Recommendations
    recommendations = []
    for cat, avg in avg_category_variance.items():
        if avg > 5:
            recommendations.append(
                f"⚠️ {cat.upper()}: Coûts réels dépassent les estimations de {avg:.1f}% en moyenne. "
                f"Revoir les tarifs de référence."
            )
        elif avg < -5:
            recommendations.append(
                f"💡 {cat.upper()}: Marge confortable ({abs(avg):.1f}% sous les estimations). "
                f"Possible de réduire les prix pour être plus compétitif."
            )

    return {
        "total_projects_tracked": len(projects),
        "overall_variance_pct": round(overall_variance, 1),
        "total_estimated": round(total_estimated, 2),
        "total_actual": round(total_actual, 2),
        "projects": projects,
        "avg_variance_by_category": avg_category_variance,
        "recommendations": recommendations,
    }
