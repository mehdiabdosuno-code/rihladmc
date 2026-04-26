"""0018 — document_templates table + activities enrichment

Creates:
- document_templates table for S'TOURS operational document templates
  (voucher, reservation, information letter, appreciation forms, tips sheet)

Revision ID: 0018
Revises: 0017
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "document_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_i18n", sa.JSON),
        sa.Column("category", sa.String(50), server_default="operational"),
        sa.Column("description", sa.Text),
        sa.Column("language", sa.String(10), server_default="fr"),
        sa.Column("fields", sa.JSON),
        sa.Column("body_html", sa.Text),
        sa.Column("body_text", sa.Text),
        sa.Column("active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("document_templates")
