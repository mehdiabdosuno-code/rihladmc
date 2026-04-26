"""Report Builder — Pydantic schemas."""

from typing import Optional, Any
from pydantic import BaseModel, Field
from app.shared.schemas import BaseResponse


# ── DataSource ────────────────────────────────────────────────────
class FieldDef(BaseModel):
    name: str
    type: str           # "num" | "str" | "date"
    label: Optional[str] = None


class DataSourceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    source_type: str = "manual"
    fields: list[FieldDef]
    records: Optional[list[dict[str, Any]]] = []


class DataSourceResponse(BaseResponse):
    name: str
    description: Optional[str]
    source_type: str
    fields: Optional[list]
    is_active: bool
    record_count: int = 0


# ── DataRecord ────────────────────────────────────────────────────
class DataRecordCreate(BaseModel):
    rows: list[dict[str, Any]]
    period: Optional[str] = None


class RecordsResponse(BaseModel):
    source: str
    fields: list
    total: int
    records: list[dict[str, Any]]


class AggregateResponse(BaseModel):
    group_by: str
    metric: str
    data: list[dict[str, Any]]


# ── Report ────────────────────────────────────────────────────────
class WidgetDef(BaseModel):
    type: str           # kpi | chart | table
    order: int = 0
    config: Optional[dict] = {}


class FilterDef(BaseModel):
    field: str
    op: str = "="       # = | contient | > | < | >=
    value: Any = ""


class ReportSettings(BaseModel):
    color: str = "#A8371D"
    group_by: Optional[str] = None
    chart_metric: Optional[str] = None
    show_totals: bool = True
    period: Optional[str] = None


class ReportCreate(BaseModel):
    name: str
    subtitle: Optional[str] = ""
    data_source_id: Optional[str] = None
    widgets: list[WidgetDef] = []
    filters: list[FilterDef] = []
    settings: ReportSettings = Field(default_factory=ReportSettings)
    is_template: bool = False


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    subtitle: Optional[str] = None
    widgets: Optional[list[WidgetDef]] = None
    filters: Optional[list[FilterDef]] = None
    settings: Optional[ReportSettings] = None
    status: Optional[str] = None


class ReportResponse(BaseResponse):
    name: str
    subtitle: Optional[str]
    data_source_id: Optional[str]
    widgets: Optional[list]
    filters: Optional[list]
    settings: Optional[dict]
    is_template: bool


class ReportSummary(BaseModel):
    id: str
    name: str
    subtitle: Optional[str]
    widgets_count: int
    is_template: bool
    updated_at: Optional[str]

    class Config:
        from_attributes = True


# ── Export ────────────────────────────────────────────────────────
class ExportRequest(BaseModel):
    report_id: str
    format: str                         # pdf | pptx | xlsx | csv
    data: list[dict[str, Any]] = []
    fields: list[FieldDef] = []
    report_name: str = "Rapport S'TOURS DMC"
    subtitle: str = ""
    settings: Optional[dict] = {}
