"""Invoice router — /api/invoices."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from app.core.database import get_db
from app.modules.invoices.schemas import (
    InvoiceCreate, InvoiceUpdate,
    InvoiceResponse, InvoiceSummary,
)
from app.modules.invoices.service import InvoiceService
from app.shared.exceptions import NotFoundError
from app.shared.dependencies import require_auth

router = APIRouter(prefix="/invoices", tags=["invoices"], dependencies=[Depends(require_auth)])


@router.post("/", response_model=InvoiceResponse, status_code=201)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    """Créer une facture manuellement."""
    return InvoiceService(db).create(data)


@router.post("/from-project/{project_id}",
             response_model=InvoiceResponse, status_code=201)
def create_from_project(
    project_id: str,
    quotation_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Générer automatiquement une facture depuis un projet confirmé."""
    return InvoiceService(db).create_from_project(project_id, quotation_id)


@router.get("/", response_model=list[InvoiceSummary])
def list_invoices(
    status: Optional[str] = None,
    limit:  int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return InvoiceService(db).list_all(status, limit, offset)


@router.get("/project/{project_id}", response_model=list[InvoiceSummary])
def list_by_project(project_id: str, db: Session = Depends(get_db)):
    return InvoiceService(db).list_by_project(project_id)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    return InvoiceService(db).get(invoice_id)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: str, data: InvoiceUpdate, db: Session = Depends(get_db)):
    return InvoiceService(db).update(invoice_id, data)


@router.post("/{invoice_id}/generate-pdf")
def generate_pdf(invoice_id: str, db: Session = Depends(get_db)):
    """Générer le PDF de la facture (layout S'TOURS + logo RIHLA)."""
    path = InvoiceService(db).generate_pdf(invoice_id)
    if not os.path.exists(path):
        raise HTTPException(500, "Erreur génération PDF")
    inv = InvoiceService(db).get(invoice_id)
    safe = inv.number.replace("-", "_")
    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=f"Facture_{safe}.pdf",
    )


@router.patch("/{invoice_id}/status")
def update_status(
    invoice_id: str,
    new_status: str,
    db: Session = Depends(get_db),
):
    from app.modules.invoices.models import InvoiceStatus
    try:
        status = InvoiceStatus(new_status)
    except ValueError:
        raise HTTPException(400, f"Statut invalide: {new_status}")
    svc = InvoiceService(db)
    inv = svc.get(invoice_id)
    inv.status = status
    db.commit()
    return {"id": invoice_id, "status": status}


from fastapi import Response

@router.get("/export/erp")
def export_erp(ids: list[str] = Query(...), db: Session = Depends(get_db)):
    """Exporter les factures sélectionnées au format Sage (CSV)."""
    csv_data = InvoiceService(db).export_for_erp(ids)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export_sage_rihla.csv"}
    )

@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    InvoiceService(db).delete(invoice_id)
