"""ERP integration models — connection configs + push audit log."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class ErpKind(str):
    """ERP backend identifier (kept as plain str for flexibility)."""

    SAP_S4HANA       = "sap_s4hana"
    SAP_BUSINESS_ONE = "sap_business_one"


class ClientErpConfig(Base, BaseMixin):
    """One row per (RIHLA company, end-client) pair that has an ERP target.

    The same RIHLA tenant (e.g. Stours Voyages) may sell to several corporate
    clients, each with its own SAP tenant — hence the (company_id, client_key)
    composite uniqueness.
    """

    __tablename__ = "erp_client_configs"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    # Free-form identifier for the end-client (e.g. invoice.client_email,
    # client_name slug, or an external client_id). Pushing an invoice will
    # look up the config by (company_id, client_key).
    client_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    label: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str]  = mapped_column(String(40), nullable=False)
    # `sap_s4hana` | `sap_business_one`

    # Common
    base_url:    Mapped[Optional[str]] = mapped_column(String(500))
    is_dry_run:  Mapped[bool]          = mapped_column(Boolean, default=True, index=True)
    is_active:   Mapped[bool]          = mapped_column(Boolean, default=True, index=True)
    notes:       Mapped[Optional[str]] = mapped_column(Text)

    # OAuth2 (S/4HANA) — token URL, client id/secret, scope.
    oauth_token_url: Mapped[Optional[str]] = mapped_column(String(500))
    oauth_client_id: Mapped[Optional[str]] = mapped_column(String(255))
    # Stored encrypted-at-rest in production via app-layer; never exposed in API.
    oauth_client_secret: Mapped[Optional[str]] = mapped_column(Text)
    oauth_scope: Mapped[Optional[str]] = mapped_column(String(500))

    # Service Layer (Business One)
    b1_company_db: Mapped[Optional[str]] = mapped_column(String(255))
    b1_username:   Mapped[Optional[str]] = mapped_column(String(255))
    b1_password:   Mapped[Optional[str]] = mapped_column(Text)

    # Mapping hints (JSON for flexibility — e.g. supplier_card_code, default tax codes)
    mapping: Mapped[Optional[dict]] = mapped_column(JSON)

    __table_args__ = (
        UniqueConstraint("company_id", "client_key", name="uq_erp_company_client"),
        Index("idx_erp_active", "company_id", "is_active"),
    )


class ErpPushLog(Base, BaseMixin):
    """Audit + idempotency log for every outbound ERP call.

    `idempotency_key = sha256(invoice_id + invoice.updated_at + config_id)` —
    a re-push is allowed only if the invoice was modified or the config changed.
    Failed pushes can be retried freely (`status=failed` rows do not block).
    """

    __tablename__ = "erp_push_logs"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    config_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("erp_client_configs.id", ondelete="SET NULL"),
        index=True,
    )
    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True, index=True)

    kind: Mapped[str] = mapped_column(String(40))
    is_dry_run: Mapped[bool] = mapped_column(Boolean, default=False)
    status:     Mapped[str]  = mapped_column(String(20), default="pending", index=True)
    # `pending` | `success` | `failed`
    http_status:    Mapped[Optional[int]] = mapped_column(Integer)
    remote_ref:     Mapped[Optional[str]] = mapped_column(String(255))
    # SupplierInvoiceID (S/4HANA) or DocEntry (Business One)

    request_payload:  Mapped[Optional[dict]] = mapped_column(JSON)
    response_payload: Mapped[Optional[dict]] = mapped_column(JSON)
    error_message:    Mapped[Optional[str]]  = mapped_column(Text)
    duration_ms:      Mapped[Optional[int]]  = mapped_column(Integer)

    __table_args__ = (
        Index("idx_erp_log_invoice_created", "invoice_id", "created_at"),
        Index("idx_erp_log_company_status",  "company_id", "status"),
    )
