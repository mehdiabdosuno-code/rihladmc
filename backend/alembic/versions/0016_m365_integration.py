"""M365 integration (Outlook Mail + SharePoint + Teams).

Revision ID: 0016_m365_integration
Revises: 0015_payment_reminders
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0016_m365_integration"
down_revision = "0015_payment_reminders"
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

    if not _has_table(insp, "m365_connections"):
        op.create_table(
            "m365_connections",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False, index=True),
            sa.Column("account_email", sa.String(255), nullable=False, index=True),
            sa.Column("display_name", sa.String(255), nullable=True),
            sa.Column("tenant_id", sa.String(64), nullable=True),
            sa.Column("scopes", sa.Text, nullable=True),
            sa.Column("access_token", sa.Text, nullable=True),
            sa.Column("refresh_token", sa.Text, nullable=True),
            sa.Column("expires_at", sa.DateTime, nullable=True),
            sa.Column("drive_id", sa.String(255), nullable=True),
            sa.Column("sharepoint_site_id", sa.String(255), nullable=True),
            sa.Column("is_demo", sa.Boolean, nullable=False, server_default=sa.text("0")),
            sa.Column("payload", sa.JSON, nullable=True),
        )
        op.create_index("idx_m365_user", "m365_connections", ["user_id"])

    if not _has_table(insp, "m365_linked_messages"):
        op.create_table(
            "m365_linked_messages",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("connection_id", sa.String(36),
                      sa.ForeignKey("m365_connections.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("project_id", sa.String(36), nullable=True, index=True),
            sa.Column("invoice_id", sa.String(36), nullable=True, index=True),
            sa.Column("message_id", sa.String(255), nullable=False),
            sa.Column("subject", sa.String(500), nullable=True),
            sa.Column("sender", sa.String(255), nullable=True),
            sa.Column("recipients", sa.Text, nullable=True),
            sa.Column("preview", sa.Text, nullable=True),
            sa.Column("direction", sa.String(10), nullable=False, server_default="in"),
            sa.Column("received_at", sa.DateTime, nullable=True),
            sa.Column("payload", sa.JSON, nullable=True),
        )


def downgrade() -> None:
    op.drop_table("m365_linked_messages")
    op.drop_index("idx_m365_user", table_name="m365_connections")
    op.drop_table("m365_connections")
