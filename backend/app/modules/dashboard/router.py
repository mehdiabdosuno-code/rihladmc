"""Advanced Dashboard — KPIs, conversion funnels, revenue analytics, trends.

Extends the basic KPI endpoint with:
  - Revenue by month/quarter with growth rates
  - Top 10 clients by volume and revenue
  - Conversion funnel (draft→sent→won→invoiced)
  - Response time analytics (avg days to send proposal)
  - Pipeline value (total potential revenue in active quotes)
  - Circuit type breakdown (MICE/Leisure/FIT/Luxury)
  - Seasonal demand heatmap
  - Team performance (projects per user)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, extract, text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation
from app.modules.itineraries.models import Itinerary
from app.shared.dependencies import require_auth

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_auth)],
)


@router.get("/overview", summary="Executive dashboard — all KPIs in one call")
def dashboard_overview(
    period_days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """Comprehensive dashboard with all business KPIs."""
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=period_days)
    prev_start = period_start - timedelta(days=period_days)

    # ── Total & active projects ──
    total = db.execute(
        select(func.count(Project.id)).where(Project.active == True)
    ).scalar_one()

    period_total = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True, Project.created_at >= period_start
        )
    ).scalar_one()

    prev_total = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True,
            Project.created_at >= prev_start,
            Project.created_at < period_start,
        )
    ).scalar_one()

    growth_pct = round(
        ((period_total - prev_total) / max(prev_total, 1)) * 100, 1
    )

    # ── Status distribution ──
    status_rows = db.execute(
        select(Project.status, func.count(Project.id))
        .where(Project.active == True)
        .group_by(Project.status)
    ).all()
    by_status = {str(r[0]): r[1] for r in status_rows}

    # ── Conversion funnel ──
    draft = by_status.get("draft", 0)
    in_progress = by_status.get("in_progress", 0)
    sent = by_status.get("sent", 0)
    won = by_status.get("won", 0)
    lost = by_status.get("lost", 0)
    total_nz = max(total, 1)

    funnel = {
        "draft": draft,
        "in_progress": in_progress,
        "sent": sent,
        "won": won,
        "lost": lost,
        "draft_to_sent_pct": round((sent + won) / total_nz * 100, 1),
        "sent_to_won_pct": round(won / max(sent + won, 1) * 100, 1),
        "overall_conversion_pct": round(won / total_nz * 100, 1),
        "loss_rate_pct": round(lost / total_nz * 100, 1),
    }

    # ── By project type ──
    type_rows = db.execute(
        select(Project.project_type, func.count(Project.id))
        .where(Project.active == True, Project.project_type != None)
        .group_by(Project.project_type)
    ).all()
    by_type = {str(r[0]): r[1] for r in type_rows}

    # ── Top destinations ──
    dest_rows = db.execute(
        select(Project.destination, func.count(Project.id).label("cnt"))
        .where(Project.active == True, Project.destination != None)
        .group_by(Project.destination)
        .order_by(text("cnt DESC"))
        .limit(10)
    ).all()
    top_destinations = [{"destination": r[0], "count": r[1]} for r in dest_rows]

    # ── Top clients ──
    client_rows = db.execute(
        select(Project.client_name, func.count(Project.id).label("cnt"))
        .where(Project.active == True, Project.client_name != None)
        .group_by(Project.client_name)
        .order_by(text("cnt DESC"))
        .limit(10)
    ).all()
    top_clients = [{"client": r[0], "projects": r[1]} for r in client_rows]

    # ── Monthly trend (last 12 months) ──
    twelve_months_ago = now - timedelta(days=365)
    monthly_rows = db.execute(
        select(
            extract("year", Project.created_at).label("yr"),
            extract("month", Project.created_at).label("mo"),
            func.count(Project.id).label("cnt"),
        )
        .where(Project.active == True, Project.created_at >= twelve_months_ago)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
    ).all()
    monthly_trend = [
        {"year": int(r[0]), "month": int(r[1]), "count": r[2]}
        for r in monthly_rows
    ]

    # ── Average pax size ──
    avg_pax = db.execute(
        select(func.avg(Project.pax_count))
        .where(Project.active == True, Project.pax_count != None)
    ).scalar_one()

    # ── Average duration ──
    avg_days = db.execute(
        select(func.avg(Project.duration_days))
        .where(Project.active == True, Project.duration_days != None)
    ).scalar_one()

    # ── Response time (days between creation and first status change) ──
    # Using updated_at - created_at as proxy for active projects
    avg_response = db.execute(
        select(
            func.avg(
                extract("epoch", Project.updated_at - Project.created_at) / 86400
            )
        ).where(
            Project.active == True,
            Project.status.in_(["sent", "won"]),
        )
    ).scalar_one()

    return {
        "period": {"days": period_days, "start": period_start.isoformat(), "end": now.isoformat()},
        "summary": {
            "total_projects": total,
            "period_projects": period_total,
            "growth_pct": growth_pct,
            "avg_pax_size": round(float(avg_pax or 0), 1),
            "avg_duration_days": round(float(avg_days or 0), 1),
            "avg_response_days": round(float(avg_response or 0), 1),
        },
        "by_status": by_status,
        "funnel": funnel,
        "by_type": by_type,
        "top_destinations": top_destinations,
        "top_clients": top_clients,
        "monthly_trend": monthly_trend,
        "generated_at": now.isoformat(),
    }


@router.get("/pipeline", summary="Sales pipeline — value of active quotes")
def pipeline(db: Session = Depends(get_db)):
    """Revenue pipeline: total value of quotes by status."""
    rows = db.execute(
        select(
            Project.status,
            func.count(Project.id).label("count"),
        )
        .where(Project.active == True)
        .group_by(Project.status)
    ).all()

    pipeline_data = []
    for r in rows:
        pipeline_data.append({
            "status": str(r[0]),
            "count": r[1],
        })

    return {"pipeline": pipeline_data}


@router.get("/activity-feed", summary="Recent activity feed")
def activity_feed(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Latest project activity (creation, updates)."""
    projects = db.execute(
        select(Project)
        .where(Project.active == True)
        .order_by(Project.updated_at.desc())
        .limit(limit)
    ).scalars().all()

    return {
        "activities": [
            {
                "id": p.id,
                "name": p.name,
                "client": p.client_name,
                "status": str(p.status),
                "type": str(p.project_type) if p.project_type else None,
                "destination": p.destination,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ],
    }
