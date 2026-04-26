"""Invoice service — business logic for RIHLA invoicing."""

import os
from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.invoices.models import Invoice, InvoiceCounter, InvoiceStatus
from app.modules.invoices.schemas import InvoiceCreate, InvoiceUpdate, InvoiceResponse
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation
from app.shared.exceptions import NotFoundError, BadRequestError


def _next_invoice_number(db: Session) -> str:
    """Atomically generate FAC-YYYY-NNNN."""
    year = datetime.now().year
    counter = db.execute(
        select(InvoiceCounter).where(InvoiceCounter.year == year)
    ).scalars().first()

    if counter is None:
        counter = InvoiceCounter(year=year, last_num=1)
        db.add(counter)
        db.flush()
        num = 1
    else:
        counter.last_num += 1
        db.flush()
        num = counter.last_num

    return f"FAC-{year}-{num:04d}"


def _compute_amounts(inv: Invoice) -> None:
    """Recalculate tax, total, deposit, balance in-place."""
    inv.tax_amount    = round(float(inv.subtotal) * float(inv.tax_rate) / 100, 2)
    inv.total         = round(float(inv.subtotal) + float(inv.tax_amount), 2)
    inv.deposit_amount= round(float(inv.total) * float(inv.deposit_pct) / 100, 2)
    inv.balance_due   = round(float(inv.total) - float(inv.deposit_amount), 2)


class InvoiceService:

    def __init__(self, db: Session):
        self.db = db

    def create_from_project(self, project_id: str,
                             quotation_id: Optional[str] = None) -> Invoice:
        """Auto-create invoice from a project and its latest quotation."""
        project = self.db.execute(
            select(Project).where(Project.id == project_id)
        ).scalars().first()
        if not project:
            raise NotFoundError(f"Projet {project_id} introuvable")

        # Resolve quotation
        quotation = None
        if quotation_id:
            quotation = self.db.execute(
                select(Quotation).where(Quotation.id == quotation_id)
            ).scalars().first()
        else:
            # Take the latest approved quotation
            quotation = self.db.execute(
                select(Quotation)
                .where(Quotation.project_id == project_id)
                .where(Quotation.status.in_(["approved", "calculated"]))
                .order_by(Quotation.version.desc())
            ).scalars().first()

        subtotal    = float(quotation.total_selling or 0) if quotation else 0
        price_per_pax = float(quotation.price_per_pax or 0) if quotation else 0

        # Build lines from quotation
        lines = []
        if quotation and quotation.lines:
            for ql in quotation.lines:
                if ql.is_included:
                    lines.append({
                        "label":      ql.label,
                        "category":   ql.category,
                        "qty":        float(ql.quantity),
                        "unit":       ql.unit or "pax",
                        "unit_price": float(ql.unit_cost),
                        "total":      float(ql.total_cost),
                    })

        number = _next_invoice_number(self.db)
        inv = Invoice(
            number        = number,
            project_id    = project_id,
            quotation_id  = quotation.id if quotation else None,
            client_name   = project.client_name,
            client_email  = project.client_email,
            travel_dates  = project.travel_dates,
            issue_date    = date.today().isoformat(),
            currency      = project.currency or "EUR",
            subtotal      = subtotal,
            tax_rate      = 0,
            deposit_pct   = 30,
            pax_count     = project.pax_count,
            price_per_pax = price_per_pax,
            payment_terms = "30% à la confirmation, solde 15 jours avant le départ.",
            lines         = lines,
        )
        _compute_amounts(inv)
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def create(self, data: InvoiceCreate) -> Invoice:
        number = _next_invoice_number(self.db)
        lines  = [l.model_dump() for l in data.lines] if data.lines else []

        # Auto-compute subtotal from lines if not provided
        subtotal = data.subtotal
        if not subtotal and lines:
            subtotal = sum(float(l.get("total", 0)) for l in lines)

        inv = Invoice(
            number        = number,
            project_id    = data.project_id,
            quotation_id  = data.quotation_id,
            client_name   = data.client_name,
            client_email  = data.client_email,
            client_address= data.client_address,
            issue_date    = data.issue_date or date.today().isoformat(),
            due_date      = data.due_date,
            travel_dates  = data.travel_dates,
            currency      = data.currency,
            subtotal      = subtotal,
            tax_rate      = data.tax_rate,
            deposit_pct   = data.deposit_pct,
            pax_count     = data.pax_count,
            price_per_pax = data.price_per_pax,
            notes         = data.notes,
            payment_terms = data.payment_terms,
            lines         = lines,
        )
        _compute_amounts(inv)
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def get(self, invoice_id: str) -> Invoice:
        inv = self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id)
        ).scalars().first()
        if not inv:
            raise NotFoundError(f"Facture {invoice_id} introuvable")
        return inv

    def list_by_project(self, project_id: str) -> list[Invoice]:
        return self.db.execute(
            select(Invoice)
            .where(Invoice.project_id == project_id)
            .where(Invoice.active == True)
            .order_by(Invoice.created_at.desc())
        ).scalars().all()

    def list_all(self, status: Optional[str] = None,
                 limit: int = 50, offset: int = 0) -> list[Invoice]:
        q = select(Invoice).where(Invoice.active == True)
        if status:
            q = q.where(Invoice.status == status)
        q = q.order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        return self.db.execute(q).scalars().all()

    def update(self, invoice_id: str, data: InvoiceUpdate) -> Invoice:
        inv = self.get(invoice_id)
        for field, value in data.model_dump(exclude_none=True).items():
            if field == "lines" and value is not None:
                setattr(inv, field, [l.model_dump() if hasattr(l,"model_dump") else l for l in value])
            else:
                setattr(inv, field, value)
        _compute_amounts(inv)
        self.db.commit()
        self.db.refresh(inv)
        return inv

    def generate_pdf(self, invoice_id: str) -> str:
        """Generate PDF and return its path."""
        from app.modules.invoices.pdf_generator import generate_invoice_pdf

        inv = self.get(invoice_id)
        project = self.db.execute(
            select(Project).where(Project.id == inv.project_id)
        ).scalars().first()

        invoice_data = {
            "number":            inv.number,
            "status":            inv.status,
            "client_name":       inv.client_name or "",
            "client_email":      inv.client_email or "",
            "client_address":    inv.client_address or "",
            "issue_date":        inv.issue_date or "",
            "due_date":          inv.due_date or "",
            "travel_dates":      inv.travel_dates or "",
            "project_reference": project.reference or project.name if project else "",
            "currency":          inv.currency,
            "subtotal":          float(inv.subtotal),
            "tax_rate":          float(inv.tax_rate),
            "deposit_pct":       float(inv.deposit_pct),
            "pax_count":         inv.pax_count,
            "price_per_pax":     float(inv.price_per_pax or 0),
            "payment_terms":     inv.payment_terms or "",
            "notes":             inv.notes or "",
            "lines":             inv.lines or [],
        }

        path = generate_invoice_pdf(invoice_data)

        inv.pdf_path      = str(path)
        inv.pdf_generated = True
        if inv.status == InvoiceStatus.DRAFT:
            inv.status = InvoiceStatus.ISSUED
        self.db.commit()
        return str(path)

    def cancel(self, invoice_id: str) -> Invoice:
        inv = self.get(invoice_id)
        inv.status = InvoiceStatus.CANCELLED
        self.db.commit()
        return inv

    def delete(self, invoice_id: str) -> None:
        inv = self.get(invoice_id)
        inv.active = False
        self.db.commit()
    def export_for_erp(self, invoice_ids: list[str]) -> str:
        """Generate a CSV export compatible with Sage Journal de Vente."""
        import csv
        import io
        from datetime import datetime

        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        
        # Headers (Sage standard simplified)
        writer.writerow(['Date', 'CodeJournal', 'CompteGeneral', 'CompteAuxiliaire', 'Libelle', 'Debit', 'Credit', 'Piece'])
        
        for inv_id in invoice_ids:
            inv = self.get(inv_id)
            issue_date = datetime.fromisoformat(inv.issue_date).strftime('%d%m%y') if inv.issue_date else datetime.now().strftime('%d%m%y')
            
            # 1. Line for Client (Debit)
            writer.writerow([
                issue_date, 'VT', '411000', inv.client_name[:20] if inv.client_name else 'CLIENT',
                f'FAC {inv.number}', round(float(inv.total), 2), 0, inv.number
            ])
            
            # 2. Line for Revenue (Credit)
            writer.writerow([
                issue_date, 'VT', '706000', '',
                f'CA {inv.number}', 0, round(float(inv.subtotal), 2), inv.number
            ])
            
            # 3. Line for Tax if any
            if float(inv.tax_amount or 0) > 0:
                writer.writerow([
                    issue_date, 'VT', '445710', '',
                    f'TVA {inv.number}', 0, round(float(inv.tax_amount), 2), inv.number
                ])
        
        return output.getvalue()
