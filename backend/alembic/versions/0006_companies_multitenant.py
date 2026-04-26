"""Multi-tenant foundation: companies, user_companies, +company_id columns.

Revision ID: 0006_companies_multitenant
Revises: 0005_indexes_and_constraints
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_companies_multitenant"
down_revision = "0005_indexes_and_constraints"
branch_labels = None
depends_on = None


# Tables we add company_id to. Each gets a NULLABLE column first; the data
# migration script (data_migration_companies.py) backfills then enforces NOT NULL.
TENANT_TABLES = [
    "projects",
    "quotations",
    "itineraries",
    "menus",
    "transports",
    "guides",
    "hotels",
    "invoices",
    "proposals",
    "field_ops",
    "expenses",
    "notifications",
    "audit_events",
]


def upgrade() -> None:
    # ── companies ─────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(16), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("tax_id", sa.String(64)),
        sa.Column("address", sa.JSON()),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("fiscal_year_start", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("settings", sa.JSON()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_company_code_active", "companies", ["code", "is_active"])

    # ── user_companies ─────────────────────────────────────────────
    op.create_table(
        "user_companies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
        sa.UniqueConstraint("user_id", "company_id", name="uq_user_company"),
    )
    op.create_index("idx_user_company_default", "user_companies",
                    ["user_id", "is_default"])
    op.create_index("ix_user_companies_user_id", "user_companies", ["user_id"])
    op.create_index("ix_user_companies_company_id",
                    "user_companies", ["company_id"])

    # ── company_id on existing tables (nullable for now) ───────────
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for tbl in TENANT_TABLES:
        if tbl not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}
        if "company_id" in cols:
            continue
        with op.batch_alter_table(tbl) as batch:
            batch.add_column(sa.Column("company_id", sa.String(36), nullable=True))
        op.create_index(f"ix_{tbl}_company_id", tbl, ["company_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for tbl in TENANT_TABLES:
        if tbl not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}
        if "company_id" not in cols:
            continue
        try:
            op.drop_index(f"ix_{tbl}_company_id", table_name=tbl)
        except Exception:
            pass
        with op.batch_alter_table(tbl) as batch:
            batch.drop_column("company_id")

    op.drop_index("ix_user_companies_company_id", table_name="user_companies")
    op.drop_index("ix_user_companies_user_id", table_name="user_companies")
    op.drop_index("idx_user_company_default", table_name="user_companies")
    op.drop_table("user_companies")

    op.drop_index("idx_company_code_active", table_name="companies")
    op.drop_table("companies")
