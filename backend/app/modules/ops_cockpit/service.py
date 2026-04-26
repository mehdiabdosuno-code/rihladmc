"""Live Ops Cockpit — aggregator over existing tables.

Read-only; no schema additions for the cockpit itself. Notes are persisted
in audit logs (project_audits / system_logs) when those exist.
"""

from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.field_ops.models import FieldTask, FieldIncident, TaskStatus  # ACTIVE/PENDING/COMPLETED/...

from app.modules.projects.models import Project, ProjectStatus
from app.modules.ops_cockpit.schemas import (
    CockpitAlert, CockpitIncident, CockpitKpis,
    CockpitProject, CockpitTask, OpsCockpitSnapshot,
)


# In-memory project list — all that have an active operational footprint.
_ACTIVE_STATUSES = {ProjectStatus.IN_PROGRESS, ProjectStatus.WON, ProjectStatus.SENT, ProjectStatus.VALIDATED}


def _project_company_match(project: Project, company_id: str) -> bool:
    """Tolerate Project not yet carrying company_id (legacy rows)."""
    pcid = getattr(project, "company_id", None)
    return pcid is None or pcid == company_id


def _user_name_index(db: Session, ids: Iterable[str]) -> dict[str, str]:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    rows = db.query(User.id, User.full_name, User.email).filter(User.id.in_(ids)).all()
    return {r[0]: (r[1] or r[2] or r[0]) for r in rows}


def _project_name_index(db: Session, ids: Iterable[str]) -> dict[str, Project]:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    rows = db.query(Project).filter(Project.id.in_(ids)).all()
    return {p.id: p for p in rows}


def build_snapshot(db: Session, company_id: str) -> OpsCockpitSnapshot:
    now = datetime.now(timezone.utc)

    # 1) Active projects (tenant-scoped, tolerant of legacy rows)
    project_q = db.query(Project).filter(
        Project.status.in_([s.value for s in _ACTIVE_STATUSES])
    )
    if hasattr(Project, "company_id"):
        project_q = project_q.filter(
            (Project.company_id == company_id) | (Project.company_id.is_(None))
        )
    active_projects = [p for p in project_q.all() if _project_company_match(p, company_id)]
    active_pids = {p.id for p in active_projects}

    # 2) Field tasks tied to active projects
    tasks = []
    if active_pids:
        tasks = (
            db.query(FieldTask)
            .filter(FieldTask.project_id.in_(active_pids))
            .order_by(FieldTask.start_time.asc().nulls_last() if hasattr(FieldTask.start_time, "asc") else FieldTask.start_time)
            .all()
        )

    # 3) Open incidents on those tasks
    open_incidents: list[FieldIncident] = []
    incident_task_ids = {t.id for t in tasks}
    if incident_task_ids:
        open_incidents = (
            db.query(FieldIncident)
            .filter(FieldIncident.task_id.in_(incident_task_ids))
            .filter(FieldIncident.is_resolved.is_(False))
            .all()
        )

    # 4) Lookups
    staff_idx = _user_name_index(
        db,
        [t.staff_id for t in tasks] + [i.staff_id for i in open_incidents],
    )
    project_idx = {p.id: p for p in active_projects}

    # 5) Build per-project rollup
    proj_rollup: dict[str, CockpitProject] = {
        p.id: CockpitProject(
            id=p.id, name=p.name, reference=p.reference,
            client_name=p.client_name, pax_count=p.pax_count,
            destination=p.destination, status=str(p.status.value if hasattr(p.status, "value") else p.status),
        ) for p in active_projects
    }
    for t in tasks:
        if t.project_id in proj_rollup and t.status in (TaskStatus.PENDING.value, TaskStatus.ACTIVE.value, TaskStatus.DELAYED.value):
            proj_rollup[t.project_id].open_tasks += 1
    for inc in open_incidents:
        task = next((tt for tt in tasks if tt.id == inc.task_id), None)
        if task and task.project_id in proj_rollup:
            proj_rollup[task.project_id].open_incidents += 1
            if (inc.severity or "").lower() in ("high", "critical"):
                proj_rollup[task.project_id].critical_incidents += 1

    # 6) KPIs
    pax_in_country = sum((p.pax_count or 0) for p in active_projects)
    tasks_in_progress = sum(1 for t in tasks if t.status == TaskStatus.ACTIVE.value)
    tasks_completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED.value)
    crit_inc = sum(1 for i in open_incidents if (i.severity or "").lower() in ("high", "critical"))

    sla_breached = 0
    for inc in open_incidents:
        # Simple SLA: critical incidents older than 30 min are breached.
        try:
            age = (now - inc.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        except Exception:
            age = 0
        if (inc.severity or "").lower() in ("high", "critical") and age > 30:
            sla_breached += 1

    kpis = CockpitKpis(
        active_projects=len(active_projects),
        pax_in_country=pax_in_country,
        tasks_today=len(tasks),
        tasks_in_progress=tasks_in_progress,
        tasks_completed=tasks_completed,
        open_incidents=len(open_incidents),
        critical_incidents=crit_inc,
        sla_breached=sla_breached,
    )

    # 7) Alerts
    alerts: list[CockpitAlert] = []
    for inc in open_incidents:
        if (inc.severity or "").lower() in ("high", "critical"):
            task = next((tt for tt in tasks if tt.id == inc.task_id), None)
            project = project_idx.get(task.project_id) if task else None
            alerts.append(CockpitAlert(
                severity="critical",
                code="incident_high_unresolved",
                message=f"Incident {inc.severity}: {inc.message[:120]}",
                project_id=project.id if project else None,
                project_name=project.name if project else None,
            ))
    # Project without any task today → ops blind spot
    for p in active_projects:
        if not any(t.project_id == p.id for t in tasks):
            alerts.append(CockpitAlert(
                severity="warning",
                code="no_task_today",
                message="Aucune tâche planifiée aujourd'hui sur ce dossier en cours.",
                project_id=p.id, project_name=p.name,
            ))

    # 8) Build outputs
    out_tasks = [
        CockpitTask(
            id=t.id, project_id=t.project_id,
            project_name=project_idx[t.project_id].name if t.project_id in project_idx else None,
            staff_id=t.staff_id, staff_name=staff_idx.get(t.staff_id),
            title=t.title, task_type=str(t.task_type.value if hasattr(t.task_type, "value") else t.task_type),
            status=str(t.status.value if hasattr(t.status, "value") else t.status),
            start_time=t.start_time, location=t.location,
            pax_count=t.pax_count, vehicle_info=t.vehicle_info,
        ) for t in tasks
    ]

    out_incidents = []
    for inc in open_incidents:
        try:
            mins = int((now - inc.created_at.replace(tzinfo=timezone.utc)).total_seconds() // 60)
        except Exception:
            mins = None
        task = next((tt for tt in tasks if tt.id == inc.task_id), None)
        proj = project_idx.get(task.project_id) if task else None
        out_incidents.append(CockpitIncident(
            id=inc.id, task_id=inc.task_id, staff_id=inc.staff_id,
            severity=inc.severity, message=inc.message,
            is_resolved=inc.is_resolved, minutes_open=mins,
            project_id=proj.id if proj else None,
            project_name=proj.name if proj else None,
            created_at=inc.created_at,
        ))

    return OpsCockpitSnapshot(
        generated_at=now,
        company_id=company_id,
        kpis=kpis,
        alerts=alerts,
        active_projects=list(proj_rollup.values()),
        tasks=out_tasks,
        incidents=out_incidents,
    )
