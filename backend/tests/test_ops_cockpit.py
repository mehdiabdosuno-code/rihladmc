"""Smoke tests for the Ops Cockpit aggregator."""

from datetime import datetime, timezone

from app.modules.field_ops.models import FieldTask, FieldIncident, TaskStatus, TaskType
from app.modules.projects.models import Project, ProjectStatus
from app.modules.ops_cockpit.service import build_snapshot


def _mk_project(db, **kw):
    p = Project(
        name=kw.get("name", "Tour Maroc"),
        status=kw.get("status", ProjectStatus.IN_PROGRESS),
        client_name=kw.get("client_name", "ACME Travel"),
        pax_count=kw.get("pax_count", 12),
        destination=kw.get("destination", "Marrakech"),
    )
    if hasattr(Project, "company_id"):
        p.company_id = kw.get("company_id", "comp-1")
    db.add(p); db.commit(); db.refresh(p)
    return p


def test_snapshot_empty(db):
    snap = build_snapshot(db, "comp-1")
    assert snap.kpis.active_projects == 0
    assert snap.kpis.tasks_today == 0
    assert snap.kpis.open_incidents == 0
    assert snap.alerts == []


def test_snapshot_with_tasks_and_incidents(db):
    p = _mk_project(db)

    t1 = FieldTask(
        project_id=p.id, staff_id="u1",
        title="Pickup aéroport", task_type=TaskType.TRANSFER,
        status=TaskStatus.ACTIVE,
        start_time="08:00", location="Marrakech Menara",
        pax_count=12,
    )
    t2 = FieldTask(
        project_id=p.id, staff_id="u2",
        title="Visite Bahia", task_type=TaskType.TOUR,
        status=TaskStatus.PENDING,
        start_time="10:30", location="Médina",
        pax_count=12,
    )
    db.add_all([t1, t2]); db.commit()

    inc = FieldIncident(
        task_id=t1.id, staff_id="u1",
        severity="critical", message="Flight retard 90 min",
        is_resolved=False,
    )
    db.add(inc); db.commit()

    snap = build_snapshot(db, "comp-1")
    assert snap.kpis.active_projects == 1
    assert snap.kpis.tasks_today == 2
    assert snap.kpis.tasks_in_progress == 1
    assert snap.kpis.open_incidents == 1
    assert snap.kpis.critical_incidents == 1
    assert any(a.code == "incident_high_unresolved" for a in snap.alerts)
    assert snap.active_projects[0].open_tasks == 2


def test_snapshot_filters_by_company(db):
    if not hasattr(Project, "company_id"):
        return  # legacy mode
    _mk_project(db, company_id="comp-A", name="A-tour")
    _mk_project(db, company_id="comp-B", name="B-tour")

    sa = build_snapshot(db, "comp-A")
    sb = build_snapshot(db, "comp-B")
    names_a = {p.name for p in sa.active_projects}
    names_b = {p.name for p in sb.active_projects}
    assert "A-tour" in names_a and "B-tour" not in names_a
    assert "B-tour" in names_b and "A-tour" not in names_b


def test_snapshot_alert_no_task_for_active_project(db):
    p = _mk_project(db, name="Idle project")
    snap = build_snapshot(db, "comp-1")
    codes = {a.code for a in snap.alerts}
    assert "no_task_today" in codes
    assert any(a.project_id == p.id for a in snap.alerts)
