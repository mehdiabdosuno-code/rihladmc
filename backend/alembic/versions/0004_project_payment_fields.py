"""Add payment, signing and branding fields to projects.

Revision ID: 0004_project_payment_fields
Revises: 0003_proposal_shares
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_project_payment_fields"
down_revision = "0003_proposal_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(sa.Column("is_signed",       sa.Boolean(),     server_default="false", nullable=False))
        batch_op.add_column(sa.Column("signed_at",       sa.String(50),    nullable=True))
        batch_op.add_column(sa.Column("signature_data",  sa.Text(),        nullable=True))
        batch_op.add_column(sa.Column("payment_status",  sa.String(50),    server_default="pending", nullable=False))
        batch_op.add_column(sa.Column("paid_at",         sa.String(50),    nullable=True))
        batch_op.add_column(sa.Column("client_country",  sa.String(100),   nullable=True))
        batch_op.add_column(sa.Column("branding_config", sa.JSON(),        nullable=True))
        batch_op.add_column(sa.Column("pax_profiles",    sa.JSON(),        nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("pax_profiles")
        batch_op.drop_column("branding_config")
        batch_op.drop_column("client_country")
        batch_op.drop_column("paid_at")
        batch_op.drop_column("payment_status")
        batch_op.drop_column("signature_data")
        batch_op.drop_column("signed_at")
        batch_op.drop_column("is_signed")
