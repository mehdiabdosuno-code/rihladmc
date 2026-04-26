"""Travel Companion: travel_links, travel_messages.

Revision ID: 0010_travel_companion
Revises: 0009_approvals
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0010_travel_companion"
down_revision = "0009_approvals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "travel_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36),
                  sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("pin", sa.String(8)),
        sa.Column("expires_at", sa.DateTime()),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_seen_at", sa.DateTime()),
        sa.Column("open_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locale", sa.String(10), nullable=False, server_default="fr"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_travel_link_project", "travel_links", ["project_id"])
    op.create_index("ix_travel_links_company_id", "travel_links", ["company_id"])
    op.create_index("ix_travel_links_project_id", "travel_links", ["project_id"])
    op.create_index("ix_travel_links_token", "travel_links", ["token"], unique=True)
    op.create_index("ix_travel_links_revoked", "travel_links", ["revoked"])

    op.create_table(
        "travel_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36),
                  sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("travel_link_id", sa.String(36),
                  sa.ForeignKey("travel_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="message"),
        sa.Column("body", sa.String(4000), nullable=False),
        sa.Column("handled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("ix_travel_messages_company_id", "travel_messages", ["company_id"])
    op.create_index("ix_travel_messages_project_id", "travel_messages", ["project_id"])
    op.create_index("ix_travel_messages_handled", "travel_messages", ["handled"])


def downgrade() -> None:
    op.drop_table("travel_messages")
    op.drop_table("travel_links")
