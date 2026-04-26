"""Supplier Performance Score: incidents + score snapshots.

Revision ID: 0011_supplier_scores
Revises: 0010_travel_companion
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0011_supplier_scores"
down_revision = "0010_travel_companion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supplier_incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("partner_id", sa.String(36),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36),
                  sa.ForeignKey("projects.id", ondelete="SET NULL")),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("kind", sa.String(40), nullable=False, server_default="other"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_supplier_incident_partner", "supplier_incidents", ["partner_id"])
    op.create_index("idx_supplier_incident_company", "supplier_incidents", ["company_id"])

    op.create_table(
        "supplier_score_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("partner_id", sa.String(36),
                  sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("review_score", sa.Integer(), nullable=False),
        sa.Column("incident_score", sa.Integer(), nullable=False),
        sa.Column("tariff_score", sa.Integer(), nullable=False),
        sa.Column("responsiveness_score", sa.Integer(), nullable=False),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_avg", sa.Numeric(4, 2), nullable=False, server_default="0"),
        sa.Column("incident_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_score_partner_date",
                    "supplier_score_snapshots", ["partner_id", "snapshot_date"])


def downgrade() -> None:
    op.drop_table("supplier_score_snapshots")
    op.drop_table("supplier_incidents")
