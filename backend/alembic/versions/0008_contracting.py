"""Contracting: contracts, seasons, rates, allotments.

Revision ID: 0008_contracting
Revises: 0007_master_data
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0008_contracting"
down_revision = "0007_master_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("supplier_id", sa.String(36),
                  sa.ForeignKey("partners.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("article_id", sa.String(36),
                  sa.ForeignKey("articles.id", ondelete="SET NULL")),
        sa.Column("article_category", sa.String(32)),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("payment_terms_days", sa.Integer()),
        sa.Column("cancellation_policy", sa.JSON()),
        sa.Column("commission_rate", sa.Numeric(5, 2)),
        sa.Column("notes", sa.String(2000)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
        sa.UniqueConstraint("company_id", "code", name="uq_contract_company_code"),
    )
    op.create_index("idx_contract_company_supplier", "contracts", ["company_id", "supplier_id"])
    op.create_index("idx_contract_validity", "contracts", ["valid_from", "valid_to"])
    op.create_index("ix_contracts_company_id", "contracts", ["company_id"])
    op.create_index("ix_contracts_supplier_id", "contracts", ["supplier_id"])
    op.create_index("ix_contracts_article_id", "contracts", ["article_id"])
    op.create_index("ix_contracts_status", "contracts", ["status"])

    op.create_table(
        "contract_seasons",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("contract_id", sa.String(36),
                  sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("ix_contract_seasons_contract_id", "contract_seasons", ["contract_id"])
    op.create_index("ix_contract_seasons_starts_on", "contract_seasons", ["starts_on"])
    op.create_index("ix_contract_seasons_ends_on", "contract_seasons", ["ends_on"])

    op.create_table(
        "contract_rates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("season_id", sa.String(36),
                  sa.ForeignKey("contract_seasons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rate_key", sa.String(64), nullable=False),
        sa.Column("pax_min", sa.Integer()),
        sa.Column("pax_max", sa.Integer()),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("notes", sa.String(500)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("ix_contract_rates_season_id", "contract_rates", ["season_id"])
    op.create_index("ix_contract_rates_rate_key", "contract_rates", ["rate_key"])

    op.create_table(
        "allotments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("season_id", sa.String(36),
                  sa.ForeignKey("contract_seasons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rate_key", sa.String(64)),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("release_days_before", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("ix_allotments_season_id", "allotments", ["season_id"])
    op.create_index("ix_allotments_rate_key", "allotments", ["rate_key"])


def downgrade() -> None:
    op.drop_table("allotments")
    op.drop_table("contract_rates")
    op.drop_table("contract_seasons")
    op.drop_table("contracts")
