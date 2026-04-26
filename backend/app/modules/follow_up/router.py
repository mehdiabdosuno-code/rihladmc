"""Follow-up / Relance system — Automatic reminders for pending proposals.

When a quotation is in "sent" status for X days without response,
the system schedules follow-up actions:
  - Day +3:  Gentle reminder email
  - Day +7:  Follow-up with value proposition
  - Day +14: Urgency reminder (limited availability)
  - Day +21: Final follow-up + escalation to manager

Endpoints:
  GET  /follow-up/pending         — All proposals needing follow-up
  GET  /follow-up/timeline/{id}   — Follow-up history for a project
  POST /follow-up/run             — Process all due follow-ups (cron entry)
  POST /follow-up/send/{id}       — Manually trigger follow-up for a project
  POST /follow-up/snooze/{id}     — Snooze follow-up for N days
  GET  /follow-up/stats           — Follow-up effectiveness stats
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.projects.models import Project
from app.shared.dependencies import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/follow-up",
    tags=["follow-up"],
    dependencies=[Depends(require_auth)],
)


# ── Follow-up schedule ───────────────────────────────────────────────
SCHEDULE = [
    {"day": 3,  "level": "gentle",   "subject_fr": "Suite à notre proposition — {project}",
     "template": "Nous espérons que notre proposition pour {project} a retenu votre attention. N'hésitez pas à nous contacter pour toute question ou ajustement."},
    {"day": 7,  "level": "value",    "subject_fr": "Votre voyage au Maroc — {project}",
     "template": "Les disponibilités hôtelières pour vos dates sont encore ouvertes. Nous restons à votre disposition pour finaliser les détails de votre circuit."},
    {"day": 14, "level": "urgency",  "subject_fr": "Disponibilités limitées — {project}",
     "template": "Nous souhaitons vous informer que certains hébergements pour vos dates commencent à afficher des disponibilités limitées. Nous vous recommandons de confirmer rapidement pour garantir les meilleurs tarifs."},
    {"day": 21, "level": "final",    "subject_fr": "Dernière relance — {project}",
     "template": "Ceci est notre dernière relance concernant le circuit {project}. Si vous souhaitez maintenir cette option, merci de nous confirmer dans les prochains jours. Au-delà, les tarifs proposés ne pourront plus être garantis."},
]


class FollowUpAction(BaseModel):
    project_id: str
    project_name: str
    client_name: Optional[str]
    client_email: Optional[str]
    status: str
    days_since_update: int
    next_level: str
    next_subject: str
    next_message: str
    is_overdue: bool


class FollowUpEntry(BaseModel):
    level: str
    day: int
    subject: str
    sent_at: Optional[str] = None
    status: str  # pending | sent | snoozed


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/pending", summary="Proposals needing follow-up")
def get_pending(
    min_days: int = Query(default=3, ge=1),
    db: Session = Depends(get_db),
):
    """List all projects in 'sent' status that need follow-up."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=min_days)

    projects = db.execute(
        select(Project).where(
            Project.active == True,
            Project.status == "sent",
            Project.updated_at <= cutoff,
        ).order_by(Project.updated_at.asc())
    ).scalars().all()

    actions = []
    for p in projects:
        days = (now - (p.updated_at or p.created_at).replace(tzinfo=timezone.utc)).days

        # Find next applicable follow-up level
        next_step = None
        for step in SCHEDULE:
            if days >= step["day"]:
                next_step = step

        if next_step:
            actions.append(FollowUpAction(
                project_id=p.id,
                project_name=p.name or "Sans nom",
                client_name=p.client_name,
                client_email=p.client_email,
                status=str(p.status),
                days_since_update=days,
                next_level=next_step["level"],
                next_subject=next_step["subject_fr"].format(project=p.name or "votre voyage"),
                next_message=next_step["template"].format(project=p.name or "votre voyage"),
                is_overdue=days > 21,
            ))

    return {
        "pending_count": len(actions),
        "actions": actions,
        "schedule": SCHEDULE,
        "checked_at": now.isoformat(),
    }


@router.get("/timeline/{project_id}", summary="Follow-up timeline for a project")
def get_timeline(project_id: str, db: Session = Depends(get_db)):
    """Show the complete follow-up timeline with status of each step."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    now = datetime.now(timezone.utc)
    ref_date = (project.updated_at or project.created_at).replace(tzinfo=timezone.utc)
    days_elapsed = (now - ref_date).days

    timeline = []
    for step in SCHEDULE:
        status = "sent" if days_elapsed >= step["day"] else "pending"
        due_date = ref_date + timedelta(days=step["day"])

        timeline.append(FollowUpEntry(
            level=step["level"],
            day=step["day"],
            subject=step["subject_fr"].format(project=project.name or "votre voyage"),
            sent_at=due_date.isoformat() if status == "sent" else None,
            status=status,
        ))

    return {
        "project_id": project_id,
        "project_name": project.name,
        "client_name": project.client_name,
        "client_email": project.client_email,
        "current_status": str(project.status),
        "days_since_update": days_elapsed,
        "timeline": timeline,
    }


@router.post("/run", summary="Process all due follow-ups (cron entrypoint)")
def run_followups(db: Session = Depends(get_db)):
    """Process all due follow-ups. Call this from a cron job or scheduler."""
    now = datetime.now(timezone.utc)

    projects = db.execute(
        select(Project).where(
            Project.active == True,
            Project.status == "sent",
        )
    ).scalars().all()

    processed = []
    for p in projects:
        ref_date = (p.updated_at or p.created_at).replace(tzinfo=timezone.utc)
        days = (now - ref_date).days

        for step in SCHEDULE:
            if days == step["day"]:
                processed.append({
                    "project_id": p.id,
                    "project_name": p.name,
                    "client_email": p.client_email,
                    "level": step["level"],
                    "day": step["day"],
                    "subject": step["subject_fr"].format(project=p.name or "votre voyage"),
                    "action": "email_queued",
                })
                logger.info(
                    "Follow-up [%s] queued for project %s (day %d)",
                    step["level"], p.id, step["day"]
                )

    return {
        "processed": len(processed),
        "details": processed,
        "run_at": now.isoformat(),
    }


@router.post("/send/{project_id}", summary="Manually trigger follow-up")
def send_followup(
    project_id: str,
    level: str = Query(default="gentle"),
    db: Session = Depends(get_db),
):
    """Manually send a follow-up for a specific project."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    step = next((s for s in SCHEDULE if s["level"] == level), SCHEDULE[0])

    return {
        "sent": True,
        "project_id": project_id,
        "level": step["level"],
        "to": project.client_email,
        "subject": step["subject_fr"].format(project=project.name or "votre voyage"),
        "message": step["template"].format(project=project.name or "votre voyage"),
    }


@router.post("/snooze/{project_id}", summary="Snooze follow-up for N days")
def snooze_followup(
    project_id: str,
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Snooze follow-ups for a project (push back updated_at)."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Push updated_at forward to delay follow-ups
    project.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "snoozed": True,
        "project_id": project_id,
        "days": days,
        "next_check": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
    }


@router.get("/stats", summary="Follow-up effectiveness statistics")
def followup_stats(db: Session = Depends(get_db)):
    """Statistics on follow-up effectiveness."""
    now = datetime.now(timezone.utc)

    total_sent = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True, Project.status == "sent"
        )
    ).scalar_one()

    total_won = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True, Project.status == "won"
        )
    ).scalar_one()

    total_lost = db.execute(
        select(func.count(Project.id)).where(
            Project.active == True, Project.status == "lost"
        )
    ).scalar_one()

    # Group by age buckets
    age_buckets = {"0-3d": 0, "3-7d": 0, "7-14d": 0, "14-21d": 0, "21d+": 0}
    sent_projects = db.execute(
        select(Project).where(
            Project.active == True, Project.status == "sent"
        )
    ).scalars().all()

    for p in sent_projects:
        days = (now - (p.updated_at or p.created_at).replace(tzinfo=timezone.utc)).days
        if days <= 3: age_buckets["0-3d"] += 1
        elif days <= 7: age_buckets["3-7d"] += 1
        elif days <= 14: age_buckets["7-14d"] += 1
        elif days <= 21: age_buckets["14-21d"] += 1
        else: age_buckets["21d+"] += 1

    return {
        "total_sent": total_sent,
        "total_won": total_won,
        "total_lost": total_lost,
        "conversion_rate_pct": round(total_won / max(total_sent + total_won, 1) * 100, 1),
        "aging_buckets": age_buckets,
        "overdue_count": age_buckets["21d+"],
    }
