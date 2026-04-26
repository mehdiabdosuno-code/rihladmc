"""Itinerary templates: reusable circuit blueprints (B1).

Revision ID: 0013_itinerary_templates
Revises: 0012_sub_agent_portal
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0013_itinerary_templates"
down_revision = "0012_sub_agent_portal"
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

    if not _has_table(insp, "itinerary_templates"):
        op.create_table(
            "itinerary_templates",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("company_id", sa.String(36), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("destination", sa.String(200), nullable=True),
            sa.Column("duration_days", sa.Integer, nullable=False, server_default="0"),
            sa.Column("language", sa.String(10), nullable=False, server_default="fr"),
            sa.Column("hotel_category", sa.String(20), nullable=True),
            sa.Column("target_audience", sa.String(50), nullable=True),
            sa.Column("tags", sa.JSON, nullable=True),
            sa.Column("thumbnail_url", sa.String(500), nullable=True),
            sa.Column("is_public", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("use_count", sa.Integer, nullable=False, server_default="0"),
        )
        op.create_index("idx_itinerary_template_company", "itinerary_templates", ["company_id"])
        op.create_index("idx_itinerary_template_destination", "itinerary_templates", ["destination"])

    if not _has_table(insp, "itinerary_template_days"):
        op.create_table(
            "itinerary_template_days",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("updated_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("template_id", sa.String(36), sa.ForeignKey("itinerary_templates.id", ondelete="CASCADE"), nullable=False),
            sa.Column("day_number", sa.Integer, nullable=False),
            sa.Column("title", sa.String(300), nullable=False),
            sa.Column("subtitle", sa.String(300), nullable=True),
            sa.Column("city", sa.String(100), nullable=True),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("hotel", sa.String(200), nullable=True),
            sa.Column("hotel_category", sa.String(20), nullable=True),
            sa.Column("meal_plan", sa.String(20), nullable=True),
            sa.Column("travel_time", sa.String(100), nullable=True),
            sa.Column("distance_km", sa.Integer, nullable=True),
            sa.Column("activities", sa.JSON, nullable=True),
            sa.Column("image_url", sa.String(500), nullable=True),
            sa.Column("image_url_2", sa.String(500), nullable=True),
        )
        op.create_index("idx_itinerary_template_day_template", "itinerary_template_days", ["template_id"])


def downgrade() -> None:
    op.drop_table("itinerary_template_days")
    op.drop_table("itinerary_templates")
