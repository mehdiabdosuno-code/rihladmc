"""Media library: shared photos & POI descriptions (B2).

Revision ID: 0014_media_library
Revises: 0013_itinerary_templates
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0014_media_library"
down_revision = "0013_itinerary_templates"
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

    if not _has_table(insp, "media_assets"):
        op.create_table(
            "media_assets",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("company_id", sa.String(36), nullable=True),
            sa.Column("asset_type", sa.String(20), nullable=False, server_default="photo"),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("subtitle", sa.String(300), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("city", sa.String(100), nullable=True),
            sa.Column("country", sa.String(50), nullable=True, server_default="Maroc"),
            sa.Column("category", sa.String(50), nullable=True),
            sa.Column("tags", sa.JSON, nullable=True),
            sa.Column("language", sa.String(10), nullable=False, server_default="fr"),
            sa.Column("image_url", sa.String(500), nullable=True),
            sa.Column("thumb_url", sa.String(500), nullable=True),
            sa.Column("source", sa.String(200), nullable=True),
            sa.Column("license", sa.String(50), nullable=True),
            sa.Column("is_public", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("use_count", sa.Integer, nullable=False, server_default="0"),
        )
        op.create_index("idx_media_company", "media_assets", ["company_id"])
        op.create_index("idx_media_city", "media_assets", ["city"])
        op.create_index("idx_media_type", "media_assets", ["asset_type"])


def downgrade() -> None:
    op.drop_table("media_assets")
