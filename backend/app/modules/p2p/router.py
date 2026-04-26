"""Procure-to-Pay router — SAP/Ariba-inspired endpoints.

Demo mode: seed-demo populates 12 PRs across 3 suppliers in various match
states so the UI is fully populated immediately.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.projects.models import Project
from app.modules.p2p.models import (
    PurchaseRequisition, PurchaseOrder, GoodsReceipt, SupplierInvoice,
    PRStatus, POStatus, SupplierInvoiceStatus, MatchStatus, PRCategory,
)

router = APIRouter(prefix="/p2p", tags=["p2p"])


# ── Schemas ───────────────────────────────────────────────────────────────

class PRCreate(BaseModel):
    title: str
    category: str = "other"
    project_id: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_email: Optional[str] = None
    qty: float = 1.0
    unit: str = "unit"
    unit_price: float = 0.0
    currency: str = "EUR"
    needed_by: Optional[str] = None
    description: Optional[str] = None


class PROut(BaseModel):
    id: str
    reference: str
    project_id: Optional[str]
    category: str
    title: str
    description: Optional[str]
    supplier_name: Optional[str]
    supplier_email: Optional[str]
    qty: float
    unit: str
    unit_price: float
    total: float
    currency: str
    needed_by: Optional[str]
    status: str
    requested_by: Optional[str]
    created_at: Optional[str]


class POCreateFromPR(BaseModel):
    requisition_id: str
    expected_delivery: Optional[str] = None
    payment_terms: str = "net_30"
    notes: Optional[str] = None


class POOut(BaseModel):
    id: str
    reference: str
    requisition_id: Optional[str]
    project_id: Optional[str]
    supplier_name: str
    supplier_email: Optional[str]
    total: float
    currency: str
    issue_date: Optional[str]
    expected_delivery: Optional[str]
    payment_terms: str
    status: str
    created_at: Optional[str]


class ReceiptCreate(BaseModel):
    po_id: str
    receipt_date: Optional[str] = None
    qty_received: float
    amount_received: float
    is_complete: bool = True
    notes: Optional[str] = None


class SupplierInvoiceCreate(BaseModel):
    po_id: Optional[str] = None
    supplier_name: str
    number: str
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    total: float
    currency: str = "EUR"


class MatchOut(BaseModel):
    po_id: str
    po_reference: str
    po_amount: float
    receipt_amount: float
    invoice_amount: float
    has_receipt: bool
    has_invoice: bool
    status: str  # MatchStatus
    variance_amount: float
    variance_pct: float
    supplier_name: str
    currency: str


class P2PStats(BaseModel):
    pr_total: int
    pr_pending_approval: int
    po_total: int
    po_open: int
    po_received: int
    invoices_received: int
    invoices_paid: int
    matched_count: int
    discrepancies: int
    spend_committed: float       # PO total
    spend_received: float        # receipts total
    spend_invoiced: float
    spend_paid: float
    currency: str


class SupplierSpend(BaseModel):
    supplier_name: str
    po_count: int
    spend_total: float
    spend_received: float
    spend_paid: float
    avg_po_value: float
    currency: str


class P2PAnalytics(BaseModel):
    stats: P2PStats
    top_suppliers: list[SupplierSpend]
    by_category: list[dict]
    matching_health: dict   # matched_pct, partial_pct, discrepancy_pct
    savings_opportunities: list[dict]


# ── Helpers ───────────────────────────────────────────────────────────────

def _next_ref(db: Session, prefix: str, model) -> str:
    year = date.today().year
    count = db.execute(select(func.count()).select_from(model)).scalar() or 0
    return f"{prefix}-{year}-{count + 1:04d}"


def _to_pr_out(pr: PurchaseRequisition) -> PROut:
    return PROut(
        id=pr.id, reference=pr.reference, project_id=pr.project_id, category=pr.category,
        title=pr.title, description=pr.description, supplier_name=pr.supplier_name,
        supplier_email=pr.supplier_email, qty=pr.qty, unit=pr.unit,
        unit_price=pr.unit_price, total=pr.total, currency=pr.currency,
        needed_by=pr.needed_by, status=pr.status, requested_by=pr.requested_by,
        created_at=pr.created_at.isoformat() if pr.created_at else None,
    )


def _to_po_out(po: PurchaseOrder) -> POOut:
    return POOut(
        id=po.id, reference=po.reference, requisition_id=po.requisition_id,
        project_id=po.project_id, supplier_name=po.supplier_name,
        supplier_email=po.supplier_email, total=po.total, currency=po.currency,
        issue_date=po.issue_date, expected_delivery=po.expected_delivery,
        payment_terms=po.payment_terms, status=po.status,
        created_at=po.created_at.isoformat() if po.created_at else None,
    )


def _compute_match(po: PurchaseOrder, receipts: list[GoodsReceipt], invoices: list[SupplierInvoice]) -> MatchOut:
    receipt_amount = sum(r.amount_received for r in receipts)
    invoice_amount = sum(i.total for i in invoices)
    has_receipt = bool(receipts)
    has_invoice = bool(invoices)

    if has_receipt and has_invoice:
        # Compare: PO ≈ receipt ≈ invoice (within 1% tolerance)
        max_amt = max(po.total, receipt_amount, invoice_amount)
        min_amt = min(po.total, receipt_amount, invoice_amount)
        variance = max_amt - min_amt
        variance_pct = (variance / po.total * 100) if po.total > 0 else 0.0
        if variance_pct <= 1.0:
            status = MatchStatus.MATCHED.value
        else:
            status = MatchStatus.DISCREPANCY.value
    elif has_receipt or has_invoice:
        status = MatchStatus.PARTIAL.value
        variance = abs(po.total - (receipt_amount or invoice_amount))
        variance_pct = (variance / po.total * 100) if po.total > 0 else 0.0
    else:
        status = MatchStatus.UNMATCHED.value
        variance = po.total
        variance_pct = 100.0

    return MatchOut(
        po_id=po.id, po_reference=po.reference, po_amount=po.total,
        receipt_amount=receipt_amount, invoice_amount=invoice_amount,
        has_receipt=has_receipt, has_invoice=has_invoice,
        status=status, variance_amount=round(variance, 2),
        variance_pct=round(variance_pct, 2),
        supplier_name=po.supplier_name, currency=po.currency,
    )


# ── PR endpoints ──────────────────────────────────────────────────────────

@router.post("/pr", response_model=PROut)
def create_pr(payload: PRCreate, db: Session = Depends(get_db),
              current: dict = Depends(get_current_user)) -> PROut:
    pr = PurchaseRequisition(
        reference=_next_ref(db, "PR", PurchaseRequisition),
        project_id=payload.project_id, category=payload.category,
        title=payload.title, description=payload.description,
        supplier_name=payload.supplier_name, supplier_email=payload.supplier_email,
        qty=payload.qty, unit=payload.unit, unit_price=payload.unit_price,
        total=payload.qty * payload.unit_price, currency=payload.currency,
        needed_by=payload.needed_by, status=PRStatus.DRAFT.value,
        requested_by=current.get("email") if isinstance(current, dict) else None,
    )
    db.add(pr); db.commit(); db.refresh(pr)
    return _to_pr_out(pr)


@router.get("/pr", response_model=list[PROut])
def list_prs(db: Session = Depends(get_db),
             _: dict = Depends(get_current_user),
             project_id: Optional[str] = None,
             status: Optional[str] = None,
             limit: int = 100) -> list[PROut]:
    q = select(PurchaseRequisition).order_by(desc(PurchaseRequisition.created_at)).limit(limit)
    if project_id:
        q = q.where(PurchaseRequisition.project_id == project_id)
    if status:
        q = q.where(PurchaseRequisition.status == status)
    return [_to_pr_out(p) for p in db.execute(q).scalars()]


@router.post("/pr/{pr_id}/approve", response_model=PROut)
def approve_pr(pr_id: str, db: Session = Depends(get_db),
               _: dict = Depends(get_current_user)) -> PROut:
    pr = db.get(PurchaseRequisition, pr_id)
    if not pr:
        raise HTTPException(404, "PR not found")
    pr.status = PRStatus.APPROVED.value
    db.commit(); db.refresh(pr)
    return _to_pr_out(pr)


@router.post("/pr/{pr_id}/reject", response_model=PROut)
def reject_pr(pr_id: str, db: Session = Depends(get_db),
              _: dict = Depends(get_current_user)) -> PROut:
    pr = db.get(PurchaseRequisition, pr_id)
    if not pr:
        raise HTTPException(404, "PR not found")
    pr.status = PRStatus.REJECTED.value
    db.commit(); db.refresh(pr)
    return _to_pr_out(pr)


# ── PO endpoints ──────────────────────────────────────────────────────────

@router.post("/po", response_model=POOut)
def create_po_from_pr(payload: POCreateFromPR, db: Session = Depends(get_db),
                      _: dict = Depends(get_current_user)) -> POOut:
    pr = db.get(PurchaseRequisition, payload.requisition_id)
    if not pr:
        raise HTTPException(404, "PR not found")
    if pr.status != PRStatus.APPROVED.value:
        raise HTTPException(400, "PR must be approved before issuing PO")

    po = PurchaseOrder(
        reference=_next_ref(db, "PO", PurchaseOrder),
        requisition_id=pr.id, project_id=pr.project_id,
        supplier_name=pr.supplier_name or "Unknown",
        supplier_email=pr.supplier_email,
        total=pr.total, currency=pr.currency,
        issue_date=date.today().isoformat(),
        expected_delivery=payload.expected_delivery or pr.needed_by,
        payment_terms=payload.payment_terms,
        status=POStatus.SENT.value, notes=payload.notes,
    )
    db.add(po)
    pr.status = PRStatus.SOURCED.value
    db.commit(); db.refresh(po)
    return _to_po_out(po)


@router.get("/po", response_model=list[POOut])
def list_pos(db: Session = Depends(get_db), _: dict = Depends(get_current_user),
             project_id: Optional[str] = None, status: Optional[str] = None,
             limit: int = 100) -> list[POOut]:
    q = select(PurchaseOrder).order_by(desc(PurchaseOrder.created_at)).limit(limit)
    if project_id:
        q = q.where(PurchaseOrder.project_id == project_id)
    if status:
        q = q.where(PurchaseOrder.status == status)
    return [_to_po_out(p) for p in db.execute(q).scalars()]


@router.get("/po/{po_id}")
def get_po_detail(po_id: str, db: Session = Depends(get_db),
                  _: dict = Depends(get_current_user)) -> dict:
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "PO not found")
    receipts = list(db.execute(select(GoodsReceipt).where(GoodsReceipt.po_id == po_id)).scalars())
    invoices = list(db.execute(select(SupplierInvoice).where(SupplierInvoice.po_id == po_id)).scalars())
    match = _compute_match(po, receipts, invoices)
    return {
        "po": _to_po_out(po).model_dump(),
        "receipts": [
            {"id": r.id, "receipt_date": r.receipt_date, "qty_received": r.qty_received,
             "amount_received": r.amount_received, "is_complete": r.is_complete}
            for r in receipts
        ],
        "invoices": [
            {"id": i.id, "number": i.number, "issue_date": i.issue_date,
             "due_date": i.due_date, "total": i.total, "status": i.status}
            for i in invoices
        ],
        "match": match.model_dump(),
    }


# ── Receipt + Invoice ─────────────────────────────────────────────────────

@router.post("/receipt")
def create_receipt(payload: ReceiptCreate, db: Session = Depends(get_db),
                   current: dict = Depends(get_current_user)) -> dict:
    po = db.get(PurchaseOrder, payload.po_id)
    if not po:
        raise HTTPException(404, "PO not found")
    rec = GoodsReceipt(
        po_id=po.id,
        receipt_date=payload.receipt_date or date.today().isoformat(),
        qty_received=payload.qty_received,
        amount_received=payload.amount_received,
        is_complete=payload.is_complete,
        received_by=current.get("email") if isinstance(current, dict) else None,
        notes=payload.notes,
    )
    db.add(rec)
    po.status = POStatus.RECEIVED.value if payload.is_complete else POStatus.PARTIALLY_RECEIVED.value
    db.commit(); db.refresh(rec)
    return {"id": rec.id, "po_id": po.id, "amount_received": rec.amount_received,
            "po_status": po.status}


@router.post("/supplier-invoice")
def create_supplier_invoice(payload: SupplierInvoiceCreate,
                            db: Session = Depends(get_db),
                            _: dict = Depends(get_current_user)) -> dict:
    inv = SupplierInvoice(
        po_id=payload.po_id, supplier_name=payload.supplier_name,
        number=payload.number, issue_date=payload.issue_date or date.today().isoformat(),
        due_date=payload.due_date, total=payload.total, currency=payload.currency,
        status=SupplierInvoiceStatus.RECEIVED.value,
    )
    db.add(inv); db.commit(); db.refresh(inv)
    return {"id": inv.id, "number": inv.number, "total": inv.total,
            "status": inv.status, "po_id": inv.po_id}


@router.post("/match/{po_id}", response_model=MatchOut)
def trigger_match(po_id: str, db: Session = Depends(get_db),
                  _: dict = Depends(get_current_user)) -> MatchOut:
    """Run 3-way match check on a PO. Updates supplier invoice status if matched."""
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "PO not found")
    receipts = list(db.execute(select(GoodsReceipt).where(GoodsReceipt.po_id == po_id)).scalars())
    invoices = list(db.execute(select(SupplierInvoice).where(SupplierInvoice.po_id == po_id)).scalars())
    match = _compute_match(po, receipts, invoices)
    if match.status == MatchStatus.MATCHED.value:
        for inv in invoices:
            if inv.status == SupplierInvoiceStatus.RECEIVED.value:
                inv.status = SupplierInvoiceStatus.MATCHED.value
        db.commit()
    return match


@router.get("/match", response_model=list[MatchOut])
def list_matches(db: Session = Depends(get_db),
                 _: dict = Depends(get_current_user)) -> list[MatchOut]:
    pos = list(db.execute(select(PurchaseOrder).order_by(desc(PurchaseOrder.created_at))).scalars())
    receipts_by_po: dict[str, list[GoodsReceipt]] = {}
    invoices_by_po: dict[str, list[SupplierInvoice]] = {}
    for r in db.execute(select(GoodsReceipt)).scalars():
        receipts_by_po.setdefault(r.po_id, []).append(r)
    for i in db.execute(select(SupplierInvoice)).scalars():
        if i.po_id:
            invoices_by_po.setdefault(i.po_id, []).append(i)
    return [
        _compute_match(po, receipts_by_po.get(po.id, []), invoices_by_po.get(po.id, []))
        for po in pos
    ]


# ── Analytics ─────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=P2PAnalytics)
def analytics(db: Session = Depends(get_db),
              _: dict = Depends(get_current_user)) -> P2PAnalytics:
    prs = list(db.execute(select(PurchaseRequisition)).scalars())
    pos = list(db.execute(select(PurchaseOrder)).scalars())
    receipts = list(db.execute(select(GoodsReceipt)).scalars())
    invoices = list(db.execute(select(SupplierInvoice)).scalars())

    pr_pending = sum(1 for p in prs if p.status == PRStatus.SUBMITTED.value)
    po_open = sum(1 for p in pos if p.status in (POStatus.SENT.value, POStatus.ACKNOWLEDGED.value, POStatus.PARTIALLY_RECEIVED.value))
    po_received = sum(1 for p in pos if p.status == POStatus.RECEIVED.value)
    inv_paid = sum(1 for i in invoices if i.status == SupplierInvoiceStatus.PAID.value)

    spend_committed = sum(p.total for p in pos if p.status not in (POStatus.CANCELLED.value, POStatus.DRAFT.value))
    spend_received = sum(r.amount_received for r in receipts)
    spend_invoiced = sum(i.total for i in invoices)
    spend_paid = sum(i.total for i in invoices if i.status == SupplierInvoiceStatus.PAID.value)

    # Compute match summary
    receipts_by_po: dict[str, list[GoodsReceipt]] = {}
    invoices_by_po: dict[str, list[SupplierInvoice]] = {}
    for r in receipts:
        receipts_by_po.setdefault(r.po_id, []).append(r)
    for i in invoices:
        if i.po_id:
            invoices_by_po.setdefault(i.po_id, []).append(i)

    matches = [_compute_match(po, receipts_by_po.get(po.id, []), invoices_by_po.get(po.id, [])) for po in pos]
    matched = sum(1 for m in matches if m.status == MatchStatus.MATCHED.value)
    partial = sum(1 for m in matches if m.status == MatchStatus.PARTIAL.value)
    discrepancy = sum(1 for m in matches if m.status == MatchStatus.DISCREPANCY.value)
    n = max(len(matches), 1)

    # Top suppliers
    by_supp: dict[str, dict] = {}
    for po in pos:
        if po.status == POStatus.CANCELLED.value:
            continue
        s = by_supp.setdefault(po.supplier_name, {"po_count": 0, "spend_total": 0.0, "spend_received": 0.0, "spend_paid": 0.0, "currency": po.currency})
        s["po_count"] += 1
        s["spend_total"] += po.total
    for r in receipts:
        po = next((p for p in pos if p.id == r.po_id), None)
        if po:
            s = by_supp.get(po.supplier_name)
            if s: s["spend_received"] += r.amount_received
    for inv in invoices:
        if inv.status != SupplierInvoiceStatus.PAID.value:
            continue
        po = next((p for p in pos if p.id == inv.po_id), None) if inv.po_id else None
        if po:
            s = by_supp.get(po.supplier_name)
            if s: s["spend_paid"] += inv.total

    top = sorted(by_supp.items(), key=lambda x: x[1]["spend_total"], reverse=True)[:10]
    top_list = [
        SupplierSpend(supplier_name=k, po_count=v["po_count"],
                      spend_total=round(v["spend_total"], 2),
                      spend_received=round(v["spend_received"], 2),
                      spend_paid=round(v["spend_paid"], 2),
                      avg_po_value=round(v["spend_total"] / max(v["po_count"], 1), 2),
                      currency=v["currency"])
        for k, v in top
    ]

    # By category
    cat_spend: dict[str, float] = {}
    cat_count: dict[str, int] = {}
    for pr in prs:
        # PR -> if PR sourced, look up corresponding PO total
        po = next((p for p in pos if p.requisition_id == pr.id), None)
        amount = po.total if po else pr.total
        cat_spend[pr.category] = cat_spend.get(pr.category, 0.0) + amount
        cat_count[pr.category] = cat_count.get(pr.category, 0) + 1
    by_category = [
        {"category": cat, "spend": round(amt, 2), "count": cat_count[cat]}
        for cat, amt in sorted(cat_spend.items(), key=lambda x: -x[1])
    ]

    # Savings opportunities (simple heuristics)
    opportunities = []
    for k, v in by_supp.items():
        if v["po_count"] >= 3 and v["spend_total"] > 5000:
            est_savings = round(v["spend_total"] * 0.05, 2)  # 5% via négociation rate card
            opportunities.append({
                "type": "rate_card",
                "supplier": k,
                "rationale": f"{v['po_count']} POs · {v['spend_total']:.0f} {v['currency']} → négocier rate card annuel",
                "estimated_savings": est_savings,
                "currency": v["currency"],
            })
    opportunities = sorted(opportunities, key=lambda x: -x["estimated_savings"])[:5]

    currency = (pos[0].currency if pos else "EUR")

    stats = P2PStats(
        pr_total=len(prs), pr_pending_approval=pr_pending,
        po_total=len(pos), po_open=po_open, po_received=po_received,
        invoices_received=len(invoices), invoices_paid=inv_paid,
        matched_count=matched, discrepancies=discrepancy,
        spend_committed=round(spend_committed, 2),
        spend_received=round(spend_received, 2),
        spend_invoiced=round(spend_invoiced, 2),
        spend_paid=round(spend_paid, 2),
        currency=currency,
    )

    return P2PAnalytics(
        stats=stats,
        top_suppliers=top_list,
        by_category=by_category,
        matching_health={
            "matched_pct": round(matched / n * 100, 1),
            "partial_pct": round(partial / n * 100, 1),
            "discrepancy_pct": round(discrepancy / n * 100, 1),
            "unmatched_pct": round((n - matched - partial - discrepancy) / n * 100, 1),
        },
        savings_opportunities=opportunities,
    )


# ── Demo seed ─────────────────────────────────────────────────────────────

@router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db),
              _: dict = Depends(get_current_user)) -> dict:
    """Seed 12 PRs across 3 suppliers in various states for demo."""
    # Wipe existing
    for model in (SupplierInvoice, GoodsReceipt, PurchaseOrder, PurchaseRequisition):
        for row in db.execute(select(model)).scalars().all():
            db.delete(row)
    db.commit()

    today = date.today()
    projects = list(db.execute(select(Project).limit(6)).scalars())
    project_ids = [p.id for p in projects] if projects else [None]

    SUPPLIERS = [
        ("Royal Mansour Marrakech", "reservations@royalmansour.com"),
        ("Booking.com Connect",     "partner@booking.com"),
        ("TBO Holidays",            "supplier@tboholidays.com"),
    ]

    seed_data = [
        # (title, category, supplier_idx, qty, unit, unit_price, days_ahead, lifecycle_state)
        # lifecycle_state: 'submitted' | 'approved' | 'po_sent' | 'received' | 'invoiced' | 'matched' | 'discrepancy' | 'paid'
        ("10 chambres Royal Mansour 5★ Discovery Tangier-Chefchaouen", "hotel", 0, 10, "nuit", 1200.0, 14, "matched"),
        ("Transferts aéroport BMW Class 5 Casablanca",                 "transport", 2, 4, "transfert", 220.0, 7, "received"),
        ("Diner gastronomique La Mamounia 25 pax",                      "restaurant", 0, 25, "couvert", 95.0, 21, "approved"),
        ("Réservations hôtels via Booking — groupe MICE",               "hotel", 1, 30, "nuit", 180.0, 30, "po_sent"),
        ("Excursion 4x4 Désert Erg Chebbi Luxury Sahara",               "activity", 2, 16, "pax", 280.0, 10, "matched"),
        ("Guide officiel marrakechi 8 jours",                           "guide", 2, 8, "jour", 350.0, 14, "discrepancy"),
        ("Petits déjeuners Booking room block 60 nuits",                "hotel", 1, 60, "nuit", 65.0, 30, "submitted"),
        ("Charter privé High Atlas 1 journée",                          "transport", 0, 1, "journée", 1800.0, 5, "paid"),
        ("Soirée tagine traditionnel Aroui FIT Family",                 "restaurant", 2, 12, "couvert", 75.0, 7, "received"),
        ("Réservations boutique hotels chefchaouen — groupe DMC",       "hotel", 1, 8, "nuit", 95.0, 12, "matched"),
        ("Activité caravane chamelière Merzouga",                       "activity", 2, 16, "pax", 180.0, 10, "approved"),
        ("Groupes incentive Atlas — petits-déjeuners",                  "hotel", 0, 25, "nuit", 110.0, 25, "submitted"),
    ]

    pr_count = po_count = rec_count = inv_count = 0
    for i, (title, cat, supp_idx, qty, unit, price, days_ahead, state) in enumerate(seed_data):
        s_name, s_email = SUPPLIERS[supp_idx]
        proj = project_ids[i % len(project_ids)] if project_ids and project_ids[0] else None
        pr = PurchaseRequisition(
            reference=f"PR-{today.year}-{i + 1:04d}",
            project_id=proj, category=cat,
            title=title, description=f"Demande automatique RIHLA pour {title.lower()}",
            supplier_name=s_name, supplier_email=s_email,
            qty=qty, unit=unit, unit_price=price, total=qty * price,
            currency="EUR", needed_by=(today + timedelta(days=days_ahead)).isoformat(),
            requested_by="a.chakir@stoursvoyages.ma",
            status=PRStatus.SUBMITTED.value if state == "submitted"
                   else PRStatus.APPROVED.value if state == "approved"
                   else PRStatus.SOURCED.value,
        )
        db.add(pr); db.flush()
        pr_count += 1

        if state in ("po_sent", "received", "invoiced", "matched", "discrepancy", "paid"):
            po = PurchaseOrder(
                reference=f"PO-{today.year}-{i + 1:04d}",
                requisition_id=pr.id, project_id=proj,
                supplier_name=s_name, supplier_email=s_email,
                total=pr.total, currency=pr.currency,
                issue_date=(today - timedelta(days=5)).isoformat(),
                expected_delivery=(today + timedelta(days=days_ahead)).isoformat(),
                payment_terms="net_30",
                status=POStatus.SENT.value if state == "po_sent"
                       else POStatus.RECEIVED.value,
            )
            db.add(po); db.flush()
            po_count += 1

            if state in ("received", "invoiced", "matched", "discrepancy", "paid"):
                rec = GoodsReceipt(
                    po_id=po.id, receipt_date=(today - timedelta(days=2)).isoformat(),
                    qty_received=qty, amount_received=pr.total,
                    is_complete=True, received_by="ops@rihla.ma",
                )
                db.add(rec); rec_count += 1

            if state in ("invoiced", "matched", "discrepancy", "paid"):
                inv_total = pr.total
                if state == "discrepancy":
                    inv_total = pr.total * 1.08  # 8% over PO
                inv = SupplierInvoice(
                    po_id=po.id, supplier_name=s_name,
                    number=f"{s_name.split()[0].upper()[:5]}-2026-{1000 + i}",
                    issue_date=(today - timedelta(days=1)).isoformat(),
                    due_date=(today + timedelta(days=29)).isoformat(),
                    total=inv_total, currency=pr.currency,
                    status=SupplierInvoiceStatus.PAID.value if state == "paid"
                           else SupplierInvoiceStatus.MATCHED.value if state == "matched"
                           else SupplierInvoiceStatus.RECEIVED.value,
                )
                db.add(inv); inv_count += 1

    db.commit()
    return {
        "ok": True, "purchase_requisitions": pr_count,
        "purchase_orders": po_count, "receipts": rec_count, "invoices": inv_count,
    }
