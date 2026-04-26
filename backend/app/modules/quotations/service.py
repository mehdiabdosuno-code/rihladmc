"""Quotation service — Deterministic pricing engine."""

from typing import Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.modules.quotations.models import Quotation, QuotationLine, LineCategory
from app.modules.quotations.schemas import (
    QuotationCreate, QuotationUpdate, QuotationRecalcResponse, PricingGridEntry
)
from app.shared.exceptions import NotFoundError, BadRequestError
from app.modules.quotations.pricing_engine import calculate_quotation as engine_calculate


PAX_BASES = [(10, 1), (15, 1), (20, 1), (25, 1), (30, 1), (35, 1)]


class QuotationService:

    def __init__(self, db: Session):
        self.db = db

    def create(self, data: QuotationCreate) -> Quotation:
        q = Quotation(
            project_id=data.project_id,
            currency=data.currency,
            margin_pct=data.margin_pct,
            notes=data.notes,
        )
        self.db.add(q)
        self.db.flush()

        for line_data in data.lines:
            line = QuotationLine(
                quotation_id=q.id,
                **line_data.model_dump(),
                total_cost=line_data.unit_cost * line_data.quantity,
            )
            self.db.add(line)

        self.db.commit()
        self.db.refresh(q)
        return q

    def get(self, quotation_id: str) -> Quotation:
        q = self.db.execute(
            select(Quotation)
            .where(Quotation.id == quotation_id)
            .options(selectinload(Quotation.lines))
        ).scalars().first()
        if not q:
            raise NotFoundError(f"Quotation {quotation_id} not found")
        return q

    def list_by_project(self, project_id: str) -> list[Quotation]:
        return self.db.execute(
            select(Quotation)
            .where(Quotation.project_id == project_id)
            .options(selectinload(Quotation.lines))
            .order_by(Quotation.version.desc())
        ).scalars().all()

    def update(self, quotation_id: str, data: QuotationUpdate) -> Quotation:
        q = self.get(quotation_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(q, field, value)
        self.db.commit()
        self.db.refresh(q)
        return q

    def add_line(self, quotation_id: str, line_data) -> QuotationLine:
        q = self.get(quotation_id)
        line = QuotationLine(
            quotation_id=quotation_id,
            **line_data.model_dump(),
            total_cost=line_data.unit_cost * line_data.quantity,
        )
        self.db.add(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    def recalculate(self, quotation_id: str, pax: int = 20) -> QuotationRecalcResponse:
        """
        Deterministic pricing engine using the pure calculation module.
        Rules:
        - Sum of lines = displayed totals, to the cent.
        - Pricing grid generated for all PAX_BASES.
        - Handles complex transport ceil rules.
        """
        q = self.get(quotation_id)
        lines = [l for l in q.lines if l.is_included]

        # Map DB lines to engine format
        engine_services = []
        for l in lines:
            # Basic mapping
            svc = {
                "id":        l.id,
                "category":  l.category.value,
                "name":      l.label,
                "active":    True,
            }
            
            # Category specific mapping
            if l.category == LineCategory.HOTEL:
                svc.update({
                    "price_per_room": float(l.unit_cost),
                    "nights":         int(l.quantity),
                    "occupancy":      l.meta.get("occupancy", "double") if l.meta else "double"
                })
            elif l.category in (LineCategory.TRANSPORT, LineCategory.GUIDE):
                svc.update({
                    "price_per_vehicle": float(l.unit_cost) if l.category == LineCategory.TRANSPORT else 0,
                    "daily_cost":       float(l.unit_cost) if l.category == LineCategory.GUIDE else 0,
                    "vehicle_capacity": l.meta.get("capacity") or l.meta.get("vehicle_capacity", 48) if l.meta else 48,
                    "days":             int(l.quantity),
                })
            elif l.category in (LineCategory.ACTIVITY, LineCategory.MONUMENT):
                svc.update({
                    "price":        float(l.unit_cost),
                    "pricing_mode": "per_person" if l.unit == "pax" else "total"
                })
            else: # MISC
                svc.update({
                    "price": float(l.unit_cost)
                })
            
            engine_services.append(svc)

        # Build ranges for the grid
        ranges = [{"min": b, "max": b, "label": f"{b}+{f} FOC"} for b, f in PAX_BASES]
        # Add the specific requested pax if not in bases
        if pax not in [b for b, f in PAX_BASES]:
            ranges.append({"min": pax, "max": pax, "label": f"{pax} pax"})

        # Run engine
        calc_result = engine_calculate(
            ranges=ranges,
            services=engine_services,
            margin_pct=float(q.margin_pct),
            currency=q.currency
        )

        # Find the specific result for the requested pax
        requested_r = next((r for r in calc_result["ranges"] if r["range_min"] == pax), calc_result["ranges"][0])

        # Map back to DB and Response
        grid = [
            PricingGridEntry(
                basis=r["range_min"],
                foc=next((f for b, f in PAX_BASES if b == r["range_min"]), 0),
                price_pax=r["selling_per_person"],
                single_supplement=q.single_supplement or round(r["selling_per_person"] * 0.25, 2), # Default if missing
                total_group=r["selling_total_group"],
                margin_per_pax=r["margin_per_pax"]
            )
            for r in calc_result["ranges"]
            if any(b == r["range_min"] for b, f in PAX_BASES) or r["range_min"] == pax
        ]

        # Update quotation
        q.total_cost       = requested_r["cost_total_group"]
        q.total_selling    = requested_r["selling_total_group"]
        q.price_per_pax    = requested_r["selling_per_person"]
        q.pricing_grid     = [g.model_dump() for g in grid]
        q.status           = "calculated"
        
        self.db.commit()

        return QuotationRecalcResponse(
            quotation_id=quotation_id,
            total_cost=requested_r["cost_total_group"],
            total_selling=requested_r["selling_total_group"],
            price_per_pax=requested_r["selling_per_person"],
            pricing_grid=grid,
            breakdown=requested_r["by_category"]
        )

    def delete(self, quotation_id: str) -> None:
        q = self.get(quotation_id)
        self.db.delete(q)
        self.db.commit()
