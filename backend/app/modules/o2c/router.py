"""Order-to-Cash unified module — SAP-inspired O2C process pilotage.

Aggregates the existing Project / Quotation / Invoice tables into a single
process view: lifecycle per dossier, funnel, KPI (DSO, conversion%, leakage),
aged receivables, bottleneck detection.

This module owns NO new tables — it is a pure analytics + orchestration layer
on top of the existing data model.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.projects.models import Project, ProjectStatus
from app.modules.quotations.models import Quotation, QuotationStatus
from app.modules.invoices.models import Invoice, InvoiceStatus

router = APIRouter(prefix="/o2c", tags=["o2c"])


# ── Pydantic schemas ──────────────────────────────────────────────────────

class O2CKpis(BaseModel):
    active_projects: int
    quotations_sent: int
    quotations_accepted: int
    invoices_issued: int
    invoices_paid: int
    invoices_overdue: int
    revenue_collected: float
    revenue_outstanding: float
    revenue_pipeline: float
    dso_days: float          # Days Sales Outstanding
    conversion_rate: float   # quoted → won %
    avg_invoice_to_payment_days: float
    leakage_count: int       # quotations sent without follow-up after 7+ days
    currency: str

class FunnelStage(BaseModel):
    stage: str
    label: str
    count: int
    value: float

class O2CFunnel(BaseModel):
    stages: list[FunnelStage]
    overall_conversion: float

class LifecycleStep(BaseModel):
    key: str
    label: str
    status: str   # done | active | pending | skipped
    timestamp: Optional[str] = None
    detail: Optional[str] = None

class LifecycleRow(BaseModel):
    project_id: str
    project_name: str
    project_reference: Optional[str]
    client_name: Optional[str]
    destination: Optional[str]
    pax: Optional[int]
    travel_dates: Optional[str]
    current_stage: str
    progress_pct: int
    days_in_stage: int
    total_value: float
    paid_value: float
    outstanding_value: float
    currency: str
    is_blocked: bool
    block_reason: Optional[str]
    steps: list[LifecycleStep]

class AgingBucket(BaseModel):
    label: str
    count: int
    amount: float

class AgedReceivables(BaseModel):
    buckets: list[AgingBucket]
    total_outstanding: float
    invoices: list[dict]

class Bottleneck(BaseModel):
    project_id: str
    project_name: str
    stage: str
    days_stuck: int
    severity: str  # info | warning | critical
    suggestion: str


# ── Helpers ───────────────────────────────────────────────────────────────

def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except (ValueError, TypeError):
        return None


def _days_between(a: Optional[str | datetime], b: date | None = None) -> int:
    if not a:
        return 0
    if isinstance(a, datetime):
        d = a.date()
    else:
        parsed = _parse_date(a)
        if not parsed:
            return 0
        d = parsed
    ref = b or date.today()
    return max((ref - d).days, 0)


def _project_total(p: Project, quos: list[Quotation], invs: list[Invoice]) -> float:
    issued = sum(float(i.total or 0) for i in invs if i.status != InvoiceStatus.CANCELLED)
    if issued > 0:
        return issued
    accepted = [q for q in quos if q.status == QuotationStatus.APPROVED]
    if accepted:
        return float(max(q.total_selling or 0 for q in accepted))
    if quos:
        return float(max(q.total_selling or 0 for q in quos))
    return 0.0


def _project_paid(invs: list[Invoice]) -> float:
    return sum(float(i.total or 0) for i in invs if i.status == InvoiceStatus.PAID)


def _build_lifecycle(p: Project, quos: list[Quotation], invs: list[Invoice]) -> tuple[list[LifecycleStep], str, int, bool, Optional[str]]:
    """Compute the 5-step O2C lifecycle for a project."""
    steps: list[LifecycleStep] = []
    today = date.today()

    # 1. Lead created
    steps.append(LifecycleStep(
        key="lead",
        label="Demande client",
        status="done",
        timestamp=p.created_at.isoformat() if p.created_at else None,
        detail=p.client_name,
    ))

    # 2. Quoted
    quotation_done = any(q.status in (QuotationStatus.APPROVED, QuotationStatus.EXPORTED) for q in quos)
    quotation_active = bool(quos) and not quotation_done
    quoted_status = "done" if quotation_done else ("active" if quotation_active else "pending")
    quoted_ts = max((q.created_at for q in quos), default=None)
    steps.append(LifecycleStep(
        key="quoted",
        label="Devis envoyé",
        status=quoted_status,
        timestamp=quoted_ts.isoformat() if quoted_ts else None,
        detail=f"{len(quos)} devis" if quos else None,
    ))

    # 3. Won / Confirmed
    won_done = p.status in (ProjectStatus.WON, ProjectStatus.SENT)
    won_status = "done" if won_done else ("skipped" if p.status == ProjectStatus.LOST else "pending" if not quotation_done else "active")
    steps.append(LifecycleStep(
        key="won",
        label="Confirmation client",
        status=won_status,
        detail="Signé" if p.is_signed else None,
    ))

    # 4. Invoiced
    invoiced_active = won_done and len(invs) == 0
    invoiced_status = "done" if invs else ("active" if invoiced_active else "pending")
    invoice_ts = max((i.created_at for i in invs), default=None)
    issued_total = sum(float(i.total or 0) for i in invs if i.status != InvoiceStatus.CANCELLED)
    steps.append(LifecycleStep(
        key="invoiced",
        label="Facturation",
        status=invoiced_status,
        timestamp=invoice_ts.isoformat() if invoice_ts else None,
        detail=f"{len([i for i in invs if i.status != InvoiceStatus.CANCELLED])} facture(s) · {issued_total:,.0f} {p.currency}".replace(",", " "),
    ))

    # 5. Paid
    paid_total = sum(float(i.total or 0) for i in invs if i.status == InvoiceStatus.PAID)
    all_paid = bool(invs) and all(i.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED) for i in invs)
    partial = paid_total > 0 and not all_paid
    paid_status = "done" if all_paid else ("active" if partial or (invs and not all_paid) else "pending")
    steps.append(LifecycleStep(
        key="paid",
        label="Encaissement",
        status=paid_status,
        detail=f"{paid_total:,.0f} / {issued_total:,.0f} {p.currency}".replace(",", " ") if invs else None,
    ))

    # Find current active stage
    current = "lead"
    for s in steps:
        if s.status == "active":
            current = s.key
            break
    else:
        # everything done or skipped
        last_done = [s for s in steps if s.status == "done"]
        if last_done:
            current = last_done[-1].key

    progress = int(sum(1 for s in steps if s.status == "done") / len(steps) * 100)

    # Block detection
    is_blocked = False
    block_reason: Optional[str] = None
    for s in steps:
        if s.status == "active" and s.timestamp:
            days = _days_between(s.timestamp)
            if s.key == "quoted" and days > 7:
                is_blocked = True
                block_reason = f"Devis envoyé il y a {days}j sans réponse"
                break
            if s.key == "won" and days > 14:
                is_blocked = True
                block_reason = f"Confirmation en attente depuis {days}j"
                break
            if s.key == "invoiced" and days > 5:
                is_blocked = True
                block_reason = f"Facturation en attente depuis {days}j"
                break

    days_in_stage = 0
    for s in steps:
        if s.key == current and s.timestamp:
            days_in_stage = _days_between(s.timestamp)
            break

    return steps, current, progress, is_blocked, block_reason


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/overview", response_model=O2CKpis)
def overview(db: Session = Depends(get_db), _: dict = Depends(get_current_user)) -> O2CKpis:
    projects = list(db.execute(select(Project)).scalars())
    quotations = list(db.execute(select(Quotation)).scalars())
    invoices = list(db.execute(select(Invoice)).scalars())

    today = date.today()
    quos_sent = [q for q in quotations if q.status in (QuotationStatus.APPROVED, QuotationStatus.EXPORTED)]
    accepted_pids = {p.id for p in projects if p.status == ProjectStatus.WON}
    won_lost_pids_set = {p.id for p in projects if p.status in (ProjectStatus.WON, ProjectStatus.LOST)}
    quos_accepted = [q for q in quotations if q.project_id in accepted_pids]

    inv_issued = [i for i in invoices if i.status != InvoiceStatus.CANCELLED]
    inv_paid = [i for i in invoices if i.status == InvoiceStatus.PAID]
    inv_overdue = []
    for i in invoices:
        if i.status in (InvoiceStatus.ISSUED, InvoiceStatus.SENT):
            due = _parse_date(i.due_date)
            if due and due < today:
                inv_overdue.append(i)

    revenue_collected = sum(float(i.total or 0) for i in inv_paid)
    revenue_outstanding = sum(float(i.total or 0) for i in inv_issued if i.status != InvoiceStatus.PAID)
    revenue_pipeline = sum(float(q.total_selling or 0) for q in quos_sent if q.project_id not in won_lost_pids_set)

    # DSO computation: average days from invoice issue → payment
    paid_days: list[int] = []
    for i in inv_paid:
        issue = _parse_date(i.issue_date) or (i.created_at.date() if i.created_at else None)
        # No paid_at on invoice — use updated_at as proxy
        paid = i.updated_at.date() if i.updated_at else None
        if issue and paid and paid >= issue:
            paid_days.append((paid - issue).days)
    avg_paid = round(sum(paid_days) / len(paid_days), 1) if paid_days else 0.0

    # Outstanding DSO
    out_days: list[int] = []
    for i in inv_issued:
        if i.status == InvoiceStatus.PAID:
            continue
        issue = _parse_date(i.issue_date) or (i.created_at.date() if i.created_at else None)
        if issue:
            out_days.append((today - issue).days)
    dso = round(sum(out_days) / len(out_days), 1) if out_days else 0.0

    # Conversion: accepted / sent
    conversion = round(len(quos_accepted) / len(quos_sent) * 100, 1) if quos_sent else 0.0

    # Leakage: quotations exported > 7 days without project marked WON or LOST
    won_lost_pids = won_lost_pids_set
    leakage = 0
    for q in quotations:
        if q.status == QuotationStatus.EXPORTED and q.updated_at and q.project_id not in won_lost_pids:
            if (today - q.updated_at.date()).days > 7:
                leakage += 1

    active_statuses = (ProjectStatus.IN_PROGRESS, ProjectStatus.VALIDATED, ProjectStatus.SENT, ProjectStatus.WON)
    active_projects = sum(1 for p in projects if p.status in active_statuses)

    currency = "EUR"
    if invoices:
        currency = invoices[0].currency or "EUR"
    elif projects:
        currency = projects[0].currency or "EUR"

    return O2CKpis(
        active_projects=active_projects,
        quotations_sent=len(quos_sent),
        quotations_accepted=len(quos_accepted),
        invoices_issued=len(inv_issued),
        invoices_paid=len(inv_paid),
        invoices_overdue=len(inv_overdue),
        revenue_collected=revenue_collected,
        revenue_outstanding=revenue_outstanding,
        revenue_pipeline=revenue_pipeline,
        dso_days=dso,
        conversion_rate=conversion,
        avg_invoice_to_payment_days=avg_paid,
        leakage_count=leakage,
        currency=currency,
    )


@router.get("/funnel", response_model=O2CFunnel)
def funnel(db: Session = Depends(get_db), _: dict = Depends(get_current_user)) -> O2CFunnel:
    projects = list(db.execute(select(Project)).scalars())
    quotations = list(db.execute(select(Quotation)).scalars())
    invoices = list(db.execute(select(Invoice)).scalars())

    leads = projects
    quoted = [p for p in projects if any(q.project_id == p.id for q in quotations)]
    accepted = [p for p in projects if p.status == ProjectStatus.WON]
    invoiced_ids = {i.project_id for i in invoices if i.status != InvoiceStatus.CANCELLED}
    invoiced = [p for p in projects if p.id in invoiced_ids]
    paid_ids = {i.project_id for i in invoices if i.status == InvoiceStatus.PAID}
    paid = [p for p in projects if p.id in paid_ids]

    def _val(items: list[Project]) -> float:
        total = 0.0
        for p in items:
            invs = [i for i in invoices if i.project_id == p.id and i.status != InvoiceStatus.CANCELLED]
            quos = [q for q in quotations if q.project_id == p.id]
            total += _project_total(p, quos, invs)
        return total

    stages = [
        FunnelStage(stage="lead",      label="Demandes",      count=len(leads),    value=_val(leads)),
        FunnelStage(stage="quoted",    label="Devis envoyés", count=len(quoted),   value=_val(quoted)),
        FunnelStage(stage="accepted",  label="Confirmés",     count=len(accepted), value=_val(accepted)),
        FunnelStage(stage="invoiced",  label="Facturés",      count=len(invoiced), value=_val(invoiced)),
        FunnelStage(stage="paid",      label="Encaissés",     count=len(paid),     value=_val(paid)),
    ]
    overall = round(len(paid) / len(leads) * 100, 1) if leads else 0.0
    return O2CFunnel(stages=stages, overall_conversion=overall)


@router.get("/lifecycle", response_model=list[LifecycleRow])
def lifecycle(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
    blocked_only: bool = Query(False),
    limit: int = Query(50, le=200),
) -> list[LifecycleRow]:
    projects = list(db.execute(select(Project).order_by(Project.updated_at.desc()).limit(limit)).scalars())
    quotations = list(db.execute(select(Quotation)).scalars())
    invoices = list(db.execute(select(Invoice)).scalars())

    rows: list[LifecycleRow] = []
    for p in projects:
        quos = [q for q in quotations if q.project_id == p.id]
        invs = [i for i in invoices if i.project_id == p.id]
        steps, current, progress, blocked, reason = _build_lifecycle(p, quos, invs)
        if blocked_only and not blocked:
            continue

        total = _project_total(p, quos, invs)
        paid = _project_paid(invs)
        outstanding = max(total - paid, 0.0)

        # days in current stage
        days = 0
        for s in steps:
            if s.key == current and s.timestamp:
                days = _days_between(s.timestamp)
                break

        rows.append(LifecycleRow(
            project_id=p.id,
            project_name=p.name,
            project_reference=p.reference,
            client_name=p.client_name,
            destination=p.destination,
            pax=p.pax_count,
            travel_dates=p.travel_dates,
            current_stage=current,
            progress_pct=progress,
            days_in_stage=days,
            total_value=total,
            paid_value=paid,
            outstanding_value=outstanding,
            currency=p.currency or "EUR",
            is_blocked=blocked,
            block_reason=reason,
            steps=steps,
        ))
    return rows


@router.get("/lifecycle/{project_id}", response_model=LifecycleRow)
def lifecycle_one(project_id: str, db: Session = Depends(get_db), _: dict = Depends(get_current_user)) -> LifecycleRow:
    p = db.execute(select(Project).where(Project.id == project_id)).scalars().first()
    if not p:
        raise HTTPException(404, "Project not found")
    quos = list(db.execute(select(Quotation).where(Quotation.project_id == project_id)).scalars())
    invs = list(db.execute(select(Invoice).where(Invoice.project_id == project_id)).scalars())
    steps, current, progress, blocked, reason = _build_lifecycle(p, quos, invs)
    total = _project_total(p, quos, invs)
    paid = _project_paid(invs)
    days = 0
    for s in steps:
        if s.key == current and s.timestamp:
            days = _days_between(s.timestamp)
            break
    return LifecycleRow(
        project_id=p.id, project_name=p.name, project_reference=p.reference,
        client_name=p.client_name, destination=p.destination, pax=p.pax_count,
        travel_dates=p.travel_dates, current_stage=current, progress_pct=progress,
        days_in_stage=days, total_value=total, paid_value=paid,
        outstanding_value=max(total - paid, 0), currency=p.currency or "EUR",
        is_blocked=blocked, block_reason=reason, steps=steps,
    )


@router.get("/aging", response_model=AgedReceivables)
def aging(db: Session = Depends(get_db), _: dict = Depends(get_current_user)) -> AgedReceivables:
    invoices = list(db.execute(select(Invoice).where(Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.SENT]))).scalars())
    today = date.today()
    buckets = {"current": 0.0, "0_30": 0.0, "30_60": 0.0, "60_90": 0.0, "90_plus": 0.0}
    counts = {"current": 0, "0_30": 0, "30_60": 0, "60_90": 0, "90_plus": 0}
    rows = []

    for i in invoices:
        due = _parse_date(i.due_date)
        amt = float(i.total or 0)
        days_overdue = (today - due).days if due else 0
        if days_overdue <= 0:
            buckets["current"] += amt; counts["current"] += 1
            label = "À échoir"
        elif days_overdue <= 30:
            buckets["0_30"] += amt; counts["0_30"] += 1
            label = "0-30j"
        elif days_overdue <= 60:
            buckets["30_60"] += amt; counts["30_60"] += 1
            label = "30-60j"
        elif days_overdue <= 90:
            buckets["60_90"] += amt; counts["60_90"] += 1
            label = "60-90j"
        else:
            buckets["90_plus"] += amt; counts["90_plus"] += 1
            label = "90j+"
        rows.append({
            "invoice_id": i.id,
            "number": i.number,
            "client_name": i.client_name,
            "amount": amt,
            "currency": i.currency,
            "due_date": i.due_date,
            "days_overdue": max(days_overdue, 0),
            "bucket": label,
            "status": i.status,
        })

    bucket_list = [
        AgingBucket(label="À échoir",  count=counts["current"], amount=buckets["current"]),
        AgingBucket(label="0-30j",     count=counts["0_30"],    amount=buckets["0_30"]),
        AgingBucket(label="30-60j",    count=counts["30_60"],   amount=buckets["30_60"]),
        AgingBucket(label="60-90j",    count=counts["60_90"],   amount=buckets["60_90"]),
        AgingBucket(label="90j+",      count=counts["90_plus"], amount=buckets["90_plus"]),
    ]
    rows.sort(key=lambda r: r["days_overdue"], reverse=True)
    return AgedReceivables(buckets=bucket_list, total_outstanding=sum(buckets.values()), invoices=rows[:50])


@router.get("/bottlenecks", response_model=list[Bottleneck])
def bottlenecks(db: Session = Depends(get_db), _: dict = Depends(get_current_user)) -> list[Bottleneck]:
    projects = list(db.execute(select(Project)).scalars())
    quotations = list(db.execute(select(Quotation)).scalars())
    invoices = list(db.execute(select(Invoice)).scalars())

    out: list[Bottleneck] = []
    for p in projects:
        quos = [q for q in quotations if q.project_id == p.id]
        invs = [i for i in invoices if i.project_id == p.id]
        steps, current, _progress, blocked, reason = _build_lifecycle(p, quos, invs)
        if not blocked:
            continue
        days = 0
        for s in steps:
            if s.key == current and s.timestamp:
                days = _days_between(s.timestamp)
                break
        severity = "critical" if days > 21 else "warning" if days > 10 else "info"
        suggestions = {
            "quoted": "Relancer le client par email + appel — vérifier objections.",
            "won": "Faire signer le contrat ou retirer l'option fournisseur.",
            "invoiced": "Émettre la facture d'acompte et envoyer le lien Stripe / CMI.",
        }
        out.append(Bottleneck(
            project_id=p.id, project_name=p.name, stage=current,
            days_stuck=days, severity=severity,
            suggestion=suggestions.get(current, "Avancer le dossier à l'étape suivante."),
        ))
    out.sort(key=lambda b: b.days_stuck, reverse=True)
    return out
