"""Sub-agent B2B Portal: link User and Project to a sub-agent Partner.

Revision ID: 0012_sub_agent_portal
Revises: 0011_supplier_scores
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0012_sub_agent_portal"
down_revision = "0011_supplier_scores"
branch_labels = None
depends_on = None


def _has_column(insp, table: str, col: str) -> bool:
    try:
        return any(c["name"] == col for c in insp.get_columns(table))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if not _has_column(insp, "users", "sub_agent_partner_id"):
        with op.batch_alter_table("users") as batch:
            batch.add_column(sa.Column("sub_agent_partner_id", sa.String(36), nullable=True))
            batch.create_foreign_key(
                "fk_users_sub_agent_partner",
                "partners", ["sub_agent_partner_id"], ["id"],
                ondelete="SET NULL",
            )
            batch.create_index("ix_users_sub_agent_partner_id", ["sub_agent_partner_id"])

    if not _has_column(insp, "projects", "sub_agent_partner_id"):
        with op.batch_alter_table("projects") as batch:
            batch.add_column(sa.Column("sub_agent_partner_id", sa.String(36), nullable=True))
            batch.create_foreign_key(
                "fk_projects_sub_agent_partner",
                "partners", ["sub_agent_partner_id"], ["id"],
                ondelete="SET NULL",
            )
            batch.create_index("ix_projects_sub_agent_partner_id", ["sub_agent_partner_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if _has_column(insp, "projects", "sub_agent_partner_id"):
        with op.batch_alter_table("projects") as batch:
            batch.drop_index("ix_projects_sub_agent_partner_id")
            batch.drop_constraint("fk_projects_sub_agent_partner", type_="foreignkey")
            batch.drop_column("sub_agent_partner_id")

    if _has_column(insp, "users", "sub_agent_partner_id"):
        with op.batch_alter_table("users") as batch:
            batch.drop_index("ix_users_sub_agent_partner_id")
            batch.drop_constraint("fk_users_sub_agent_partner", type_="foreignkey")
            batch.drop_column("sub_agent_partner_id")
