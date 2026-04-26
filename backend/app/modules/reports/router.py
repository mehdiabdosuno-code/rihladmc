"""Report Builder router — /api/reports, /api/datasources, /api/reports/exports."""

import os
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.modules.reports.models import DataSource, DataRecord, Report, ExportLog
from app.modules.reports.schemas import (
    DataSourceCreate, DataSourceResponse, DataRecordCreate, RecordsResponse,
    AggregateResponse, ReportCreate, ReportUpdate, ReportResponse, ReportSummary,
    ExportRequest,
)
from app.modules.reports.exporters import export_pdf, export_pptx, export_xlsx, export_csv
from app.shared.exceptions import NotFoundError
from app.shared.dependencies import require_auth

router = APIRouter()

MIME = {
    "pdf":  "application/pdf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv":  "text/csv",
}


# ══════════════════════════════════════════════════════════════════
# DATA SOURCES
# ══════════════════════════════════════════════════════════════════

ds_router = APIRouter(prefix="/datasources", tags=["report-datasources"], dependencies=[Depends(require_auth)])


def _apply_filters(records: list, filters: list) -> list:
    result = records
    for f in filters:
        field = f.get("field"); op = f.get("op", "="); val = f.get("value", "")
        if not field or val == "":
            continue
        filtered = []
        for row in result:
            rv = row.get(field, "")
            try:
                if op == "=":
                    if str(rv).lower() == str(val).lower(): filtered.append(row)
                elif op == "contient":
                    if str(val).lower() in str(rv).lower(): filtered.append(row)
                elif op == ">":
                    if float(rv) > float(val): filtered.append(row)
                elif op == "<":
                    if float(rv) < float(val): filtered.append(row)
                elif op == ">=":
                    if float(rv) >= float(val): filtered.append(row)
            except (ValueError, TypeError):
                pass
        result = filtered
    return result


@ds_router.get("/", response_model=list[DataSourceResponse])
def list_sources(db: Session = Depends(get_db)):
    sources = db.execute(
        select(DataSource).where(DataSource.is_active == True)
    ).scalars().all()
    result = []
    for s in sources:
        count = db.execute(
            select(DataRecord).where(DataRecord.data_source_id == s.id)
        ).scalars()
        result.append(DataSourceResponse(
            id=s.id, name=s.name, description=s.description,
            source_type=s.source_type, fields=s.fields,
            is_active=s.is_active, record_count=len(list(count)),
            created_at=s.created_at, updated_at=s.updated_at,
            active=s.active,
        ))
    return result


@ds_router.post("/", status_code=201)
def create_source(data: DataSourceCreate, db: Session = Depends(get_db)):
    src = DataSource(
        name=data.name, description=data.description,
        source_type=data.source_type,
        fields=[f.model_dump() for f in data.fields],
    )
    db.add(src)
    db.flush()
    for row in data.records:
        db.add(DataRecord(data_source_id=src.id, row_data=row))
    db.commit()
    db.refresh(src)
    return {"id": src.id, "message": f"Source créée avec {len(data.records)} enregistrements"}


@ds_router.get("/{source_id}/records", response_model=RecordsResponse)
def get_records(
    source_id: str,
    filters: Optional[str] = None,
    db: Session = Depends(get_db),
):
    src = db.execute(select(DataSource).where(DataSource.id == source_id)).scalars().first()
    if not src:
        raise NotFoundError("Source introuvable")
    raw = db.execute(
        select(DataRecord).where(DataRecord.data_source_id == source_id)
    ).scalars().all()
    rows = [r.row_data for r in raw]
    if filters:
        import json
        try:
            rows = _apply_filters(rows, json.loads(filters))
        except Exception:
            pass
    return RecordsResponse(source=src.name, fields=src.fields or [], total=len(rows), records=rows)


@ds_router.post("/{source_id}/records", status_code=201)
def add_records(source_id: str, data: DataRecordCreate, db: Session = Depends(get_db)):
    for row in data.rows:
        db.add(DataRecord(data_source_id=source_id, row_data=row, period=data.period))
    db.commit()
    return {"message": f"{len(data.rows)} enregistrements ajoutés"}


@ds_router.get("/{source_id}/aggregate", response_model=AggregateResponse)
def aggregate(
    source_id: str,
    group_by: str,
    metric: str,
    db: Session = Depends(get_db),
):
    src = db.execute(select(DataSource).where(DataSource.id == source_id)).scalars().first()
    if not src:
        raise NotFoundError("Source introuvable")
    raw = db.execute(
        select(DataRecord).where(DataRecord.data_source_id == source_id)
    ).scalars().all()
    groups: dict[str, float] = {}
    for r in raw:
        key = str(r.row_data.get(group_by, "Autre"))
        try:
            val = float(r.row_data.get(metric, 0) or 0)
        except (ValueError, TypeError):
            val = 0
        groups[key] = groups.get(key, 0) + val
    return AggregateResponse(
        group_by=group_by, metric=metric,
        data=[{"label": k, "value": round(v, 2)}
              for k, v in sorted(groups.items(), key=lambda x: -x[1])],
    )


# ══════════════════════════════════════════════════════════════════
# REPORTS
# ══════════════════════════════════════════════════════════════════

rep_router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_auth)])


@rep_router.get("/", response_model=list[ReportSummary])
def list_reports(db: Session = Depends(get_db)):
    reports = db.execute(
        select(Report).where(Report.active == True).order_by(Report.updated_at.desc())
    ).scalars().all()
    return [
        ReportSummary(
            id=r.id, name=r.name, subtitle=r.subtitle,
            widgets_count=len(r.widgets or []),
            is_template=r.is_template,
            updated_at=r.updated_at.isoformat() if r.updated_at else None,
        )
        for r in reports
    ]


@rep_router.post("/", response_model=ReportResponse, status_code=201)
def create_report(data: ReportCreate, db: Session = Depends(get_db)):
    report = Report(
        name=data.name, subtitle=data.subtitle,
        data_source_id=data.data_source_id,
        widgets=[w.model_dump() for w in data.widgets],
        filters=[f.model_dump() for f in data.filters],
        settings=data.settings.model_dump(),
        is_template=data.is_template,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@rep_router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    r = db.execute(select(Report).where(Report.id == report_id)).scalars().first()
    if not r:
        raise NotFoundError("Rapport introuvable")
    return r


@rep_router.put("/{report_id}", response_model=ReportResponse)
def update_report(report_id: str, data: ReportUpdate, db: Session = Depends(get_db)):
    r = db.execute(select(Report).where(Report.id == report_id)).scalars().first()
    if not r:
        raise NotFoundError("Rapport introuvable")
    update = data.model_dump(exclude_none=True)
    for field, value in update.items():
        if field == "widgets":
            setattr(r, field, [w.model_dump() if hasattr(w, 'model_dump') else w for w in value])
        elif field == "filters":
            setattr(r, field, [f.model_dump() if hasattr(f, 'model_dump') else f for f in value])
        elif field == "settings":
            setattr(r, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        else:
            setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return r


@rep_router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str, db: Session = Depends(get_db)):
    r = db.execute(select(Report).where(Report.id == report_id)).scalars().first()
    if not r:
        raise NotFoundError("Rapport introuvable")
    r.active = False
    db.commit()


# ── Export endpoint ───────────────────────────────────────────────
@rep_router.post("/exports/generate")
def generate_export(req: ExportRequest, db: Session = Depends(get_db)):
    fmt = req.format.lower()
    if fmt == "pdf":
        path = export_pdf(req)
    elif fmt == "pptx":
        path = export_pptx(req)
    elif fmt == "xlsx":
        path = export_xlsx(req)
    elif fmt == "csv":
        path = export_csv(req)
    else:
        raise HTTPException(400, f"Format '{fmt}' non supporté (pdf|pptx|xlsx|csv)")

    size = os.path.getsize(path)
    # Log export
    try:
        log = ExportLog(
            report_id=req.report_id, format=fmt,
            file_path=str(path), file_size=size,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()

    safe_name = req.report_name.replace(" ", "_").replace("'", "")[:50]
    return FileResponse(
        path=str(path),
        media_type=MIME.get(fmt, "application/octet-stream"),
        filename=f"{safe_name}.{fmt}",
        headers={"X-File-Size": str(size)},
    )
