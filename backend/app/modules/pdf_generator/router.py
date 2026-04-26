"""PDF Proposal Generator — Produces branded PDF proposals from project data.

Endpoints:
  POST /pdf/generate/{project_id}  → Generate PDF, return download link
  GET  /pdf/download/{filename}    → Serve generated PDF file
  POST /pdf/preview/{project_id}   → Return rendered HTML (for debugging)
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from jinja2 import Template
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.itineraries.models import Itinerary, ItineraryDay
from app.modules.pdf_generator.templates import PROPOSAL_CSS, PROPOSAL_HTML
from app.modules.projects.models import Project
from app.modules.quotations.models import Quotation
from app.modules.quotations.pricing_engine import calculate_quotation
from app.shared.dependencies import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pdf",
    tags=["pdf-generator"],
    dependencies=[Depends(require_auth)],
)

# Output directory for generated PDFs
PDF_OUTPUT_DIR = Path("/tmp/rihla_pdfs")
PDF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Schemas ───────────────────────────────────────────────────────────

class PaxRange(BaseModel):
    min: int
    max: Optional[int] = None
    label: Optional[str] = None


class PDFGenerateRequest(BaseModel):
    """Request body for PDF generation with optional pricing."""
    services: Optional[list[dict]] = None
    ranges: Optional[list[PaxRange]] = None
    margin_pct: float = 18.0
    language: str = "fr"


class PDFGenerateResponse(BaseModel):
    filename: str
    download_url: str
    pages_estimated: int
    generated_at: str


# ── Helpers ───────────────────────────────────────────────────────────

def _load_project_data(db: Session, project_id: str) -> dict:
    """Load project, itinerary days, and quotation from DB."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, f"Project {project_id} not found")

    # Itinerary days
    itin = db.execute(
        select(Itinerary).where(Itinerary.project_id == project_id)
    ).scalars().first()

    days = []
    if itin:
        rows = db.execute(
            select(ItineraryDay)
            .where(ItineraryDay.itinerary_id == itin.id)
            .order_by(ItineraryDay.day_number)
        ).scalars().all()
        days = [
            {
                "day_number": d.day_number,
                "title": d.title,
                "subtitle": d.subtitle,
                "city": d.city,
                "description": d.description,
                "hotel": d.hotel,
                "hotel_category": d.hotel_category,
                "meal_plan": d.meal_plan,
                "travel_time": d.travel_time,
                "distance_km": d.distance_km,
                "activities": d.activities or [],
            }
            for d in rows
        ]

    # Quotation
    quotation = db.execute(
        select(Quotation).where(Quotation.project_id == project_id)
    ).scalars().first()

    return {
        "project": {
            "name": project.name,
            "reference": project.reference,
            "client_name": project.client_name,
            "client_email": project.client_email,
            "destination": project.destination,
            "duration_days": project.duration_days,
            "duration_nights": project.duration_nights,
            "pax_count": project.pax_count,
            "travel_dates": project.travel_dates,
            "language": project.language,
            "currency": project.currency,
            "highlights": project.highlights or [],
            "inclusions": project.inclusions or [],
            "exclusions": project.exclusions or [],
        },
        "days": days,
        "quotation": quotation,
    }


def _render_html(data: dict, pricing_data: Optional[dict], language: str, margin_pct: float) -> str:
    """Render the Jinja2 template to HTML."""
    template = Template(PROPOSAL_HTML)

    # Prepare pricing ranges for template
    pricing_ranges = []
    best_price = None
    best_price_label = ""
    cost_breakdown = None
    currency = data["project"].get("currency", "EUR")

    if pricing_data and pricing_data.get("ranges"):
        for rng in pricing_data["ranges"]:
            pricing_ranges.append(
                type("R", (), {
                    "label": rng["range_label"],
                    "basis": rng["basis"],
                    "cost_per_person": rng["cost_per_person"],
                    "selling_per_person": rng["selling_per_person"],
                    "selling_total_group": rng["selling_total_group"],
                })()
            )
            if best_price is None or rng["selling_per_person"] < best_price:
                best_price = rng["selling_per_person"]
                best_price_label = rng["range_label"]

        # Cost breakdown from first range
        cost_breakdown = pricing_data["ranges"][0].get("by_category", {})

    return template.render(
        css=PROPOSAL_CSS,
        language=language,
        project=data["project"],
        days=data["days"],
        pricing_ranges=pricing_ranges,
        margin_pct=margin_pct,
        currency=currency,
        best_price=best_price,
        best_price_label=best_price_label,
        cost_breakdown=cost_breakdown,
    )


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/generate/{project_id}", response_model=PDFGenerateResponse)
def generate_pdf(
    project_id: str,
    body: PDFGenerateRequest,
    db: Session = Depends(get_db),
):
    """Generate a branded PDF proposal for a project.

    Optionally include pricing grid by providing services + ranges in the body.
    """
    data = _load_project_data(db, project_id)

    # Run pricing engine if services provided
    pricing_data = None
    if body.services and body.ranges:
        pricing_result = calculate_quotation(
            ranges=[r.model_dump() for r in body.ranges],
            services=body.services,
            margin_pct=body.margin_pct,
            currency=data["project"].get("currency", "EUR"),
        )
        pricing_data = pricing_result

    # Render HTML
    html = _render_html(data, pricing_data, body.language, body.margin_pct)

    # Generate PDF via WeasyPrint
    filename = f"proposition_{project_id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    output_path = PDF_OUTPUT_DIR / filename

    try:
        from weasyprint import HTML as WeasyprintHTML
        WeasyprintHTML(string=html).write_pdf(str(output_path))
    except ImportError:
        # Fallback: save HTML for manual conversion
        html_path = output_path.with_suffix(".html")
        html_path.write_text(html, encoding="utf-8")
        return PDFGenerateResponse(
            filename=html_path.name,
            download_url=f"/api/pdf/download/{html_path.name}",
            pages_estimated=max(1, len(data["days"]) // 3 + 3),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # Estimate pages (cover + days/3 + pricing + terms)
    pages = 1 + max(1, len(data["days"]) // 3) + (1 if pricing_data else 0) + 1

    logger.info("Generated PDF: %s (%d pages est.)", filename, pages)

    return PDFGenerateResponse(
        filename=filename,
        download_url=f"/api/pdf/download/{filename}",
        pages_estimated=pages,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/download/{filename}")
def download_pdf(filename: str):
    """Serve a generated PDF file."""
    filepath = PDF_OUTPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")

    media_type = "application/pdf" if filename.endswith(".pdf") else "text/html"
    return FileResponse(
        str(filepath),
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview/{project_id}", response_class=HTMLResponse)
def preview_html(
    project_id: str,
    body: PDFGenerateRequest,
    db: Session = Depends(get_db),
):
    """Return rendered HTML preview (for debugging / browser preview)."""
    data = _load_project_data(db, project_id)

    pricing_data = None
    if body.services and body.ranges:
        pricing_result = calculate_quotation(
            ranges=[r.model_dump() for r in body.ranges],
            services=body.services,
            margin_pct=body.margin_pct,
            currency=data["project"].get("currency", "EUR"),
        )
        pricing_data = pricing_result

    html = _render_html(data, pricing_data, body.language, body.margin_pct)
    return HTMLResponse(content=html)
