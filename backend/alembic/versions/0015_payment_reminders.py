"""Payment reminders (Agent Acompte — SAP-inspired Joule Agent).

Revision ID: 0015_payment_reminders
Revises: 0014_media_library
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0015_payment_reminders"
down_revision = "0014_media_library"
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

    if not _has_table(insp, "payment_reminders"):
        op.create_table(
            "payment_reminders",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("level", sa.Integer, nullable=False, server_default="0"),
            sa.Column("kind", sa.String(20), nullable=False, server_default="email"),
            sa.Column("subject", sa.String(300), nullable=True),
            sa.Column("body_preview", sa.Text, nullable=True),
            sa.Column("recipient", sa.String(255), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="sent"),
            sa.Column("scheduled_at", sa.DateTime, nullable=True),
            sa.Column("sent_at", sa.DateTime, nullable=True),
            sa.Column("payload", sa.JSON, nullable=True),
        )
        op.create_index("idx_pr_invoice", "payment_reminders", ["invoice_id"])
        op.create_index("idx_pr_status", "payment_reminders", ["status"])


def downgrade() -> None:
    op.drop_index("idx_pr_status", table_name="payment_reminders")
    op.drop_index("idx_pr_invoice", table_name="payment_reminders")
    op.drop_table("payment_reminders")
