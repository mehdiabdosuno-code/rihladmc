"""Add performance indexes and UNIQUE constraints.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-25
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Projects ──────────────────────────────────────────────────────
    # UNIQUE sur reference (non-null uniquement — expression index en PostgreSQL)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_reference "
        "ON projects (reference) WHERE reference IS NOT NULL"
    )
    # Index composé pour les requêtes de listing fréquentes
    op.create_index("ix_projects_status_updated_at", "projects",
                    ["status", "updated_at"], postgresql_using="btree")
    op.create_index("ix_projects_active_type", "projects",
                    ["active", "project_type"], postgresql_using="btree")
    # Index full-text sur name + client_name + destination (PostgreSQL)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_projects_search_fts ON projects "
        "USING gin(to_tsvector('french', coalesce(name,'') || ' ' || "
        "coalesce(client_name,'') || ' ' || coalesce(destination,'')))"
    )

    # ── Quotations ────────────────────────────────────────────────────
    op.create_index("ix_quotations_project_id", "quotations",
                    ["project_id"], postgresql_using="btree")
    op.create_index("ix_quotations_status_created", "quotations",
                    ["status", "created_at"], postgresql_using="btree")

    # ── Itineraries ───────────────────────────────────────────────────
    op.create_index("ix_itineraries_project_id", "itineraries",
                    ["project_id"], postgresql_using="btree")

    # ── Invoices ──────────────────────────────────────────────────────
    op.create_index("ix_invoices_project_id", "invoices",
                    ["project_id"], postgresql_using="btree")
    op.create_index("ix_invoices_status", "invoices",
                    ["status"], postgresql_using="btree")

    # ── AI Requests (audit) ───────────────────────────────────────────
    op.create_index("ix_ai_requests_user_created", "ai_requests",
                    ["user_id", "created_at"], postgresql_using="btree")

    # ── Notifications ─────────────────────────────────────────────────
    op.create_index("ix_notifications_user_read", "notifications",
                    ["user_id", "is_read"], postgresql_using="btree")

    # ── Users ─────────────────────────────────────────────────────────
    # UNIQUE email déjà présent via model, on s'assure de l'index de perf
    op.create_index("ix_users_email_active", "users",
                    ["email", "is_active"], postgresql_using="btree")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_projects_reference")
    op.execute("DROP INDEX IF EXISTS ix_projects_search_fts")
    op.drop_index("ix_projects_status_updated_at", "projects")
    op.drop_index("ix_projects_active_type", "projects")
    op.drop_index("ix_quotations_project_id", "quotations")
    op.drop_index("ix_quotations_status_created", "quotations")
    op.drop_index("ix_itineraries_project_id", "itineraries")
    op.drop_index("ix_invoices_project_id", "invoices")
    op.drop_index("ix_invoices_status", "invoices")
    op.drop_index("ix_ai_requests_user_created", "ai_requests")
    op.drop_index("ix_notifications_user_read", "notifications")
    op.drop_index("ix_users_email_active", "users")
