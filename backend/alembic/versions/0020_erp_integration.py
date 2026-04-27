"""ERP integration — client SAP S/4HANA & Business One push.

Revision ID: 0020_erp_integration
Revises: 0019
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0020_erp_integration"
down_revision = "0019"
branch_labels = None
depends_on = None


def _has_table(insp, name: str) -> bool:
    try:
        return name in insp.get_table_names()
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if not _has_table(insp, "erp_client_configs"):
        op.create_table(
            "erp_client_configs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column(
                "company_id", sa.String(36),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False, index=True,
            ),
            sa.Column("client_key", sa.String(255), nullable=False, index=True),
            sa.Column("label", sa.String(255), nullable=False),
            sa.Column("kind", sa.String(40), nullable=False),
            sa.Column("base_url", sa.String(500), nullable=True),
            sa.Column("is_dry_run", sa.Boolean, nullable=False, server_default=sa.text("1"),
                      index=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("1"),
                      index=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("oauth_token_url", sa.String(500), nullable=True),
            sa.Column("oauth_client_id", sa.String(255), nullable=True),
            sa.Column("oauth_client_secret", sa.Text, nullable=True),
            sa.Column("oauth_scope", sa.String(500), nullable=True),
            sa.Column("b1_company_db", sa.String(255), nullable=True),
            sa.Column("b1_username", sa.String(255), nullable=True),
            sa.Column("b1_password", sa.Text, nullable=True),
            sa.Column("mapping", sa.JSON, nullable=True),
            sa.UniqueConstraint("company_id", "client_key", name="uq_erp_company_client"),
        )
        op.create_index("idx_erp_active", "erp_client_configs", ["company_id", "is_active"])

    if not _has_table(insp, "erp_push_logs"):
        op.create_table(
            "erp_push_logs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("1")),
            sa.Column(
                "company_id", sa.String(36),
                sa.ForeignKey("companies.id", ondelete="CASCADE"),
                nullable=False, index=True,
            ),
            sa.Column(
                "config_id", sa.String(36),
                sa.ForeignKey("erp_client_configs.id", ondelete="SET NULL"),
                nullable=True, index=True,
            ),
            sa.Column(
                "invoice_id", sa.String(36),
                sa.ForeignKey("invoices.id", ondelete="CASCADE"),
                nullable=False, index=True,
            ),
            sa.Column("idempotency_key", sa.String(80), nullable=False, unique=True, index=True),
            sa.Column("kind", sa.String(40), nullable=False),
            sa.Column("is_dry_run", sa.Boolean, nullable=False, server_default=sa.text("0")),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending",
                      index=True),
            sa.Column("http_status", sa.Integer, nullable=True),
            sa.Column("remote_ref", sa.String(255), nullable=True),
            sa.Column("request_payload", sa.JSON, nullable=True),
            sa.Column("response_payload", sa.JSON, nullable=True),
            sa.Column("error_message", sa.Text, nullable=True),
            sa.Column("duration_ms", sa.Integer, nullable=True),
        )
        op.create_index(
            "idx_erp_log_invoice_created", "erp_push_logs",
            ["invoice_id", "created_at"],
        )
        op.create_index(
            "idx_erp_log_company_status", "erp_push_logs",
            ["company_id", "status"],
        )


def downgrade() -> None:
    op.drop_index("idx_erp_log_company_status", table_name="erp_push_logs")
    op.drop_index("idx_erp_log_invoice_created", table_name="erp_push_logs")
    op.drop_table("erp_push_logs")
    op.drop_index("idx_erp_active", table_name="erp_client_configs")
    op.drop_table("erp_client_configs")
