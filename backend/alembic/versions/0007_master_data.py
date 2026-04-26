"""Master Data: partners + articles tables.

Revision ID: 0007_master_data
Revises: 0006_companies_multitenant
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0007_master_data"
down_revision = "0006_companies_multitenant"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "partners",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("phone", sa.String(64)),
        sa.Column("address", sa.JSON()),
        sa.Column("tax_id", sa.String(64)),
        sa.Column("bank_iban", sa.String(64)),
        sa.Column("bank_swift", sa.String(16)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("payment_terms_days", sa.Integer()),
        sa.Column("credit_limit", sa.Numeric(14, 2)),
        sa.Column("legacy_table", sa.String(64)),
        sa.Column("legacy_id", sa.String(36)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_partner_company_code", "partners", ["company_id", "code"], unique=True)
    op.create_index("idx_partner_company_type", "partners", ["company_id", "type"])
    op.create_index("idx_partner_legacy", "partners", ["legacy_table", "legacy_id"])
    op.create_index("ix_partners_company_id", "partners", ["company_id"])
    op.create_index("ix_partners_code", "partners", ["code"])
    op.create_index("ix_partners_name", "partners", ["name"])
    op.create_index("ix_partners_type", "partners", ["type"])
    op.create_index("ix_partners_is_active", "partners", ["is_active"])

    op.create_table(
        "articles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False, server_default="unit"),
        sa.Column("purchase_price", sa.Numeric(14, 2)),
        sa.Column("sell_price", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("vat_rate", sa.Numeric(5, 2)),
        sa.Column("default_supplier_id", sa.String(36),
                  sa.ForeignKey("partners.id", ondelete="SET NULL")),
        sa.Column("attributes", sa.JSON()),
        sa.Column("legacy_table", sa.String(64)),
        sa.Column("legacy_id", sa.String(36)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_article_company_code", "articles", ["company_id", "code"], unique=True)
    op.create_index("idx_article_company_category", "articles", ["company_id", "category"])
    op.create_index("idx_article_legacy", "articles", ["legacy_table", "legacy_id"])
    op.create_index("ix_articles_company_id", "articles", ["company_id"])
    op.create_index("ix_articles_code", "articles", ["code"])
    op.create_index("ix_articles_name", "articles", ["name"])
    op.create_index("ix_articles_category", "articles", ["category"])
    op.create_index("ix_articles_default_supplier_id", "articles", ["default_supplier_id"])
    op.create_index("ix_articles_is_active", "articles", ["is_active"])


def downgrade() -> None:
    op.drop_table("articles")
    op.drop_table("partners")
