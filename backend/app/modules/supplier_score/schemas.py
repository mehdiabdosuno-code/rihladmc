"""Supplier score — schemas."""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


# Incidents -----------------------------------------------------------------

class SupplierIncidentCreate(BaseModel):
    partner_id: str
    project_id: Optional[str] = None
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")
    kind: str = Field("other", max_length=40)
    description: str = Field(..., min_length=2, max_length=2000)
    occurred_at: Optional[datetime] = None  # defaults to now


class SupplierIncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    partner_id: str
    project_id: Optional[str]
    severity: str
    kind: str
    description: str
    occurred_at: datetime
    resolved_at: Optional[datetime]
    created_at: datetime


# Score breakdown -----------------------------------------------------------

class ScoreBreakdown(BaseModel):
    review_score: int       # 0..40
    incident_score: int     # 0..30
    tariff_score: int       # 0..15
    responsiveness_score: int  # 0..15
    review_count: int
    review_avg: float
    incident_count: int


class SupplierScoreOut(BaseModel):
    partner_id: str
    partner_name: str
    partner_type: str
    total_score: int        # 0..100
    grade: str              # A | B | C | D
    breakdown: ScoreBreakdown
    period_days: int
    computed_at: datetime


class SupplierScoreSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    partner_id: str
    snapshot_date: date
    total_score: int
    review_score: int
    incident_score: int
    tariff_score: int
    responsiveness_score: int
    review_count: int
    review_avg: float
    incident_count: int
