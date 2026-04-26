"""SAP-inspired Joule Agent #1a — Agent Acompte (autonomous payment reminder workflow).

When an invoice transitions to status=sent (or has unpaid deposit),
the agent schedules and sends a sequence of reminders:
  - Day 0  : initial polite email + Stripe link
  - Day +3 : friendly nudge
  - Day +7 : firm reminder + escalation note
  - Day +10: escalation to commercial team

Endpoints:
  GET  /api/payment-agent/queue                — invoices currently being chased
  GET  /api/payment-agent/timeline/{invoice}   — reminder history + next scheduled
  POST /api/payment-agent/run                  — process all due reminders now (cron entrypoint)
  POST /api/payment-agent/trigger/{invoice}    — manually fire next reminder
  POST /api/payment-agent/pause/{invoice}      — pause the agent for an invoice
  POST /api/payment-agent/resume/{invoice}     — resume
  GET  /api/payment-agent/settings             — current schedule (days)
  GET  /api/payment-agent/stats                — counts by level + total at risk
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.invoices.models import Invoice
from app.modules.payment_reminders.models import PaymentReminder

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/payment-agent",
    tags=["payment-agent"],
    dependencies=[Depends(require_auth)],
)

# ── Schedule (days after invoice issue_date) ─────────────────────────
SCHEDULE = [
    (0,  "initial",  "courtois"),
    (3,  "nudge",    "amical"),
    (7,  "firm",     "ferme"),
    (10, "escalate", "escalade interne"),
]

# Map level (0..4) -> (days_offset, kind, tone)
LEVEL_META = {i: (d, k, t) for i, (d, k, t) in enumerate(SCHEDULE)}

# Pause registry (in-memory; per-invoice)
_PAUSED: set[str] = set()


# ── Schemas ──────────────────────────────────────────────────────────

class ReminderOut(BaseModel):
    id: str
    invoice_id: str
    level: int
    kind: str
    subject: Optional[str]
    body_preview: Optional[str]
    recipient: Optional[str]
    status: str
    scheduled_at: Optional[str]
    sent_at: Optional[str]


class QueueItem(BaseModel):
    invoice_id: str
    invoice_number: str
    client_name: Optional[str]
    client_email: Optional[str]
    total: float
    deposit_amount: float
    currency: str
    issue_date: Optional[str]
    due_date: Optional[str]
    last_level: int
    next_level: Optional[int]
    next_due_at: Optional[str]
    is_paused: bool
    days_overdue: int


class RunReport(BaseModel):
    processed: int
    sent: int
    skipped_paid: int
    skipped_paused: int
    items: list[ReminderOut]


class Stats(BaseModel):
    queue_size: int
    total_at_risk: float
    currency_breakdown: dict[str, float]
    by_level: dict[int, int]
    paused: int


class TimelineResponse(BaseModel):
    invoice_id: str
    invoice_number: str
    client_email: Optional[str]
    history: list[ReminderOut]
    next_level: Optional[int]
    next_due_at: Optional[str]
    is_paused: bool


# ── Helpers ──────────────────────────────────────────────────────────

def _to_iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _row(r: PaymentReminder) -> ReminderOut:
    return ReminderOut(
        id=r.id,
        invoice_id=r.invoice_id,
        level=r.level,
        kind=r.kind,
        subject=r.subject,
        body_preview=r.body_preview,
        recipient=r.recipient,
        status=r.status,
        scheduled_at=_to_iso(r.scheduled_at),
        sent_at=_to_iso(r.sent_at),
    )


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return None


def _is_unpaid(inv: Invoice) -> bool:
    return inv.status not in ("paid", "cancelled", "draft")


def _last_level(db: Session, invoice_id: str) -> int:
    row = (
        db.execute(
            select(PaymentReminder)
            .where(PaymentReminder.invoice_id == invoice_id)
            .order_by(PaymentReminder.level.desc())
        )
        .scalars()
        .first()
    )
    return row.level if row else -1


def _next_due(inv: Invoice, last_level: int) -> tuple[Optional[int], Optional[datetime]]:
    """Return (next_level, scheduled_at) or (None, None) if escalation done."""
    if last_level >= len(SCHEDULE) - 1:
        return None, None
    base = _parse_date(inv.issue_date) or inv.created_at or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    next_level = last_level + 1
    days_offset, _, _ = LEVEL_META[next_level]
    return next_level, base + timedelta(days=days_offset)


def _build_email(inv: Invoice, level: int) -> tuple[str, str]:
    """Return (subject, body_preview) tailored to level."""
    days_offset, kind, tone = LEVEL_META[level]
    client = inv.client_name or "Cher client"
    deposit = inv.deposit_amount or 0
    currency = inv.currency or "EUR"
    invoice_no = inv.number

    if level == 0:
        subject = f"Facture {invoice_no} — Acompte de {deposit:.2f} {currency}"
        body = (
            f"{client},\n\n"
            f"Nous avons le plaisir de vous transmettre la facture d'acompte n° {invoice_no} "
            f"d'un montant de {deposit:.2f} {currency}.\n\n"
            f"Vous pouvez régler en ligne par carte bancaire (Stripe ou CMI) "
            f"via le lien sécurisé qui vous sera envoyé séparément.\n\n"
            f"Bien cordialement,\nL'équipe RIHLA."
        )
    elif level == 1:
        subject = f"Rappel · Facture {invoice_no} (J+3)"
        body = (
            f"{client},\n\n"
            f"Petit rappel concernant la facture d'acompte n° {invoice_no} "
            f"({deposit:.2f} {currency}). Sauf erreur de notre part, "
            f"nous n'avons pas encore reçu le règlement.\n\n"
            f"Si le paiement est en cours, merci d'ignorer ce message.\n\n"
            f"Cordialement,\nL'équipe RIHLA."
        )
    elif level == 2:
        subject = f"2ᵉ rappel · Facture {invoice_no} échue (J+7)"
        body = (
            f"{client},\n\n"
            f"Nous attirons votre attention sur la facture d'acompte n° {invoice_no} "
            f"({deposit:.2f} {currency}) dont le règlement reste en attente.\n\n"
            f"Sans nouvelles d'ici 3 jours, votre dossier sera transféré "
            f"à notre service commercial pour suivi prioritaire.\n\n"
            f"L'équipe RIHLA."
        )
    else:
        subject = f"Escalade interne — Facture {invoice_no} impayée (J+10)"
        body = (
            f"[ESCALADE INTERNE]\n"
            f"Facture {invoice_no} — {client} — {deposit:.2f} {currency} — "
            f"impayée depuis 10 jours. Action requise par l'équipe commerciale."
        )

    return subject, body


def _send_email(inv: Invoice, subject: str, body: str) -> str:
    """Send the email if SMTP configured, else log to console.

    Returns delivery status: 'sent' | 'simulated' | 'failed'.
    """
    smtp_host = getattr(settings, "SMTP_HOST", None)
    if not smtp_host:
        logger.info("[Agent Acompte SIMULATED] %s -> %s : %s", inv.number, inv.client_email, subject)
        return "simulated"
    try:
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = getattr(settings, "SMTP_FROM", "noreply@rihla.ma")
        msg["To"] = inv.client_email or ""
        with smtplib.SMTP(smtp_host, getattr(settings, "SMTP_PORT", 587)) as s:
            if getattr(settings, "SMTP_USER", None):
                s.starttls()
                s.login(settings.SMTP_USER, settings.SMTP_PASS)
            s.send_message(msg)
        return "sent"
    except Exception as e:
        logger.warning("[Agent Acompte FAILED] %s : %s", inv.number, e)
        return "failed"


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings_info() -> dict[str, Any]:
    return {
        "schedule": [
            {"level": i, "days_offset": d, "kind": k, "tone": t}
            for i, (d, k, t) in enumerate(SCHEDULE)
        ],
        "smtp_configured": bool(getattr(settings, "SMTP_HOST", None)),
        "is_demo": not bool(getattr(settings, "SMTP_HOST", None)),
    }


@router.get("/queue", response_model=list[QueueItem])
def get_queue(db: Session = Depends(get_db)) -> list[QueueItem]:
    items: list[QueueItem] = []
    invoices = db.execute(select(Invoice)).scalars().all()
    now = datetime.now(timezone.utc)
    for inv in invoices:
        if not _is_unpaid(inv):
            continue
        last = _last_level(db, inv.id)
        next_level, next_due = _next_due(inv, last)
        issue = _parse_date(inv.issue_date) or inv.created_at
        if issue and issue.tzinfo is None:
            issue = issue.replace(tzinfo=timezone.utc)
        days_overdue = (now - issue).days if issue else 0
        items.append(QueueItem(
            invoice_id=inv.id,
            invoice_number=inv.number,
            client_name=inv.client_name,
            client_email=inv.client_email,
            total=float(inv.total or 0),
            deposit_amount=float(inv.deposit_amount or 0),
            currency=inv.currency or "EUR",
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            last_level=last,
            next_level=next_level,
            next_due_at=_to_iso(next_due),
            is_paused=inv.id in _PAUSED,
            days_overdue=days_overdue,
        ))
    items.sort(key=lambda x: (x.is_paused, -x.days_overdue))
    return items


@router.get("/timeline/{invoice_id}", response_model=TimelineResponse)
def get_timeline(invoice_id: str, db: Session = Depends(get_db)) -> TimelineResponse:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    history = (
        db.execute(
            select(PaymentReminder)
            .where(PaymentReminder.invoice_id == invoice_id)
            .order_by(PaymentReminder.level)
        )
        .scalars()
        .all()
    )
    last = history[-1].level if history else -1
    next_level, next_due = _next_due(inv, last)
    return TimelineResponse(
        invoice_id=inv.id,
        invoice_number=inv.number,
        client_email=inv.client_email,
        history=[_row(r) for r in history],
        next_level=next_level,
        next_due_at=_to_iso(next_due),
        is_paused=inv.id in _PAUSED,
    )


@router.post("/run", response_model=RunReport)
def run_agent(force: bool = False, db: Session = Depends(get_db)) -> RunReport:
    """Process all invoices: send any reminder whose scheduled_at is past.

    `force=True` ignores the schedule and triggers the next level for every unpaid invoice.
    """
    processed = 0
    sent = 0
    skipped_paid = 0
    skipped_paused = 0
    fired: list[ReminderOut] = []
    now = datetime.now(timezone.utc)

    for inv in db.execute(select(Invoice)).scalars().all():
        if not _is_unpaid(inv):
            skipped_paid += 1
            continue
        if inv.id in _PAUSED:
            skipped_paused += 1
            continue
        last = _last_level(db, inv.id)
        next_level, next_due = _next_due(inv, last)
        if next_level is None:
            continue
        if not force and next_due and next_due > now:
            continue
        # Send
        subject, body = _build_email(inv, next_level)
        delivery = _send_email(inv, subject, body)
        kind = LEVEL_META[next_level][1]
        rem = PaymentReminder(
            invoice_id=inv.id,
            level=next_level,
            kind=kind,
            subject=subject,
            body_preview=body[:500],
            recipient=inv.client_email,
            status=delivery,
            scheduled_at=next_due,
            sent_at=now,
            payload={"tone": LEVEL_META[next_level][2], "delivery": delivery},
        )
        db.add(rem)
        db.flush()
        processed += 1
        if delivery in ("sent", "simulated"):
            sent += 1
        fired.append(_row(rem))
    db.commit()
    return RunReport(
        processed=processed,
        sent=sent,
        skipped_paid=skipped_paid,
        skipped_paused=skipped_paused,
        items=fired,
    )


@router.post("/trigger/{invoice_id}", response_model=ReminderOut)
def trigger(invoice_id: str, db: Session = Depends(get_db)) -> ReminderOut:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if not _is_unpaid(inv):
        raise HTTPException(400, "Invoice not eligible (paid/cancelled/draft)")
    last = _last_level(db, inv.id)
    next_level, next_due = _next_due(inv, last)
    if next_level is None:
        raise HTTPException(400, "All escalation levels reached for this invoice")
    subject, body = _build_email(inv, next_level)
    delivery = _send_email(inv, subject, body)
    rem = PaymentReminder(
        invoice_id=inv.id,
        level=next_level,
        kind=LEVEL_META[next_level][1],
        subject=subject,
        body_preview=body[:500],
        recipient=inv.client_email,
        status=delivery,
        scheduled_at=next_due,
        sent_at=datetime.now(timezone.utc),
        payload={"tone": LEVEL_META[next_level][2], "delivery": delivery, "manual": True},
    )
    db.add(rem)
    db.commit()
    db.refresh(rem)
    return _row(rem)


@router.post("/pause/{invoice_id}")
def pause(invoice_id: str) -> dict:
    _PAUSED.add(invoice_id)
    return {"invoice_id": invoice_id, "is_paused": True}


@router.post("/resume/{invoice_id}")
def resume(invoice_id: str) -> dict:
    _PAUSED.discard(invoice_id)
    return {"invoice_id": invoice_id, "is_paused": False}


@router.get("/stats", response_model=Stats)
def stats(db: Session = Depends(get_db)) -> Stats:
    queue = get_queue(db)
    total = sum(q.total for q in queue)
    by_level: dict[int, int] = {}
    by_currency: dict[str, float] = {}
    for q in queue:
        by_level[q.last_level] = by_level.get(q.last_level, 0) + 1
        by_currency[q.currency] = by_currency.get(q.currency, 0.0) + q.total
    return Stats(
        queue_size=len(queue),
        total_at_risk=round(total, 2),
        currency_breakdown={k: round(v, 2) for k, v in by_currency.items()},
        by_level=by_level,
        paused=len(_PAUSED),
    )
