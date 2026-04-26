"""Invoice models — Facturation automatique RIHLA Tourist Platform.

Déclenchement : Project.status → WON/CONFIRMED
Numérotation  : FAC-YYYY-NNNN (ex: FAC-2026-0001)
Template      : basé sur le modèle S'TOURS (logo + footer 3 colonnes)
"""

from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Integer, Numeric, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, BaseMixin


class InvoiceStatus(str, Enum):
    DRAFT     = "draft"
    ISSUED    = "issued"       # émise
    SENT      = "sent"         # envoyée au client
    PAID      = "paid"         # réglée
    CANCELLED = "cancelled"    # annulée


class InvoiceCounter(Base, BaseMixin):
    """Compteur séquentiel par année — garantit FAC-YYYY-NNNN sans doublon."""

    __tablename__ = "invoice_counters"

    year:     Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    last_num: Mapped[int] = mapped_column(Integer, default=0)


class InvoiceTemplate(Base, BaseMixin):
    """Modèle de facture uploadé (DOCX/XLSX) avec mapping des variables."""

    __tablename__ = "invoice_templates"

    name:          Mapped[str]           = mapped_column(String(200), nullable=False)
    filename:      Mapped[str]           = mapped_column(String(300))
    file_path:     Mapped[Optional[str]] = mapped_column(String(500))
    # variables trouvées dans le template: {"{{client}}": "project.client_name", ...}
    variable_map:  Mapped[Optional[dict]]= mapped_column(JSON)
    is_default:    Mapped[bool]          = mapped_column(Boolean, default=False)
    notes:         Mapped[Optional[str]] = mapped_column(Text)


class Invoice(Base, BaseMixin):
    """Facture générée pour un projet confirmé."""

    __tablename__ = "invoices"

    # Identification
    number:       Mapped[str]           = mapped_column(String(30), unique=True, nullable=False, index=True)
    # ex: FAC-2026-0001

    # Relations
    project_id:   Mapped[str]           = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quotation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True
    )
    template_id:  Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("invoice_templates.id", ondelete="SET NULL"), nullable=True
    )

    # Client (dénormalisé pour archivage)
    client_name:  Mapped[Optional[str]] = mapped_column(String(300))
    client_email: Mapped[Optional[str]] = mapped_column(String(255))
    client_address:Mapped[Optional[str]]= mapped_column(Text)

    # Dates
    issue_date:   Mapped[Optional[str]] = mapped_column(String(20))  # ISO date
    due_date:     Mapped[Optional[str]] = mapped_column(String(20))
    travel_dates: Mapped[Optional[str]] = mapped_column(String(200))

    # Montants
    currency:     Mapped[str]           = mapped_column(String(10), default="EUR")
    subtotal:     Mapped[float]         = mapped_column(Numeric(12, 2), default=0)
    tax_rate:     Mapped[float]         = mapped_column(Numeric(5, 2), default=0)   # % TVA
    tax_amount:   Mapped[float]         = mapped_column(Numeric(12, 2), default=0)
    total:        Mapped[float]         = mapped_column(Numeric(12, 2), default=0)
    deposit_pct:  Mapped[float]         = mapped_column(Numeric(5, 2), default=30)  # % acompte
    deposit_amount:Mapped[float]        = mapped_column(Numeric(12, 2), default=0)
    balance_due:  Mapped[float]         = mapped_column(Numeric(12, 2), default=0)
    pax_count:    Mapped[Optional[int]] = mapped_column(Integer)
    price_per_pax:Mapped[Optional[float]]= mapped_column(Numeric(12, 2))

    # Statut & export
    status:       Mapped[InvoiceStatus] = mapped_column(String(30), default=InvoiceStatus.DRAFT)
    pdf_path:     Mapped[Optional[str]] = mapped_column(String(500))
    pdf_generated:Mapped[bool]          = mapped_column(Boolean, default=False)
    notes:        Mapped[Optional[str]] = mapped_column(Text)
    payment_terms:Mapped[Optional[str]] = mapped_column(Text)

    # Lignes de détail (JSON pour souplesse)
    lines:        Mapped[Optional[dict]]= mapped_column(JSON)
    # [{label, qty, unit_price, total, category}]

    project   = relationship("Project",   foreign_keys=[project_id])
    quotation = relationship("Quotation", foreign_keys=[quotation_id])
    template  = relationship("InvoiceTemplate", foreign_keys=[template_id])

    __table_args__ = (
        Index("idx_invoice_project", "project_id"),
        Index("idx_invoice_status",  "status"),
        Index("idx_invoice_number",  "number"),
    )
