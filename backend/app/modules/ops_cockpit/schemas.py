"""Live Operations Cockpit — schemas (no DB models, read-only aggregation)."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CockpitTask(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    project_name: Optional[str] = None
    staff_id: str
    staff_name: Optional[str] = None
    title: str
    task_type: str
    status: str
    start_time: Optional[str] = None
    location: Optional[str] = None
    pax_count: Optional[int] = None
    vehicle_info: Optional[str] = None


class CockpitIncident(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    task_id: Optional[str] = None
    staff_id: str
    severity: str
    message: str
    is_resolved: bool
    minutes_open: Optional[int] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    created_at: datetime


class CockpitProject(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    reference: Optional[str] = None
    client_name: Optional[str] = None
    pax_count: Optional[int] = None
    destination: Optional[str] = None
    status: str
    open_tasks: int = 0
    open_incidents: int = 0
    critical_incidents: int = 0


class CockpitKpis(BaseModel):
    active_projects: int = 0
    pax_in_country: int = 0
    tasks_today: int = 0
    tasks_in_progress: int = 0
    tasks_completed: int = 0
    open_incidents: int = 0
    critical_incidents: int = 0
    sla_breached: int = 0


class CockpitAlert(BaseModel):
    severity: str    # info | warning | critical
    code: str        # e.g. "no_guide_today", "incident_high_unresolved"
    message: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None


class OpsCockpitSnapshot(BaseModel):
    generated_at: datetime
    company_id: str
    kpis: CockpitKpis
    alerts: list[CockpitAlert] = Field(default_factory=list)
    active_projects: list[CockpitProject] = Field(default_factory=list)
    tasks: list[CockpitTask] = Field(default_factory=list)
    incidents: list[CockpitIncident] = Field(default_factory=list)


class CockpitNote(BaseModel):
    project_id: str
    body: str = Field(..., min_length=2, max_length=1000)
