"""Portail client/guide + notifications temps réel.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # ── reviews ────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id",            sa.String(36),  primary_key=True),
        sa.Column("project_id",    sa.String(36),  sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id",   sa.String(36),  sa.ForeignKey("users.id",    ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_name", sa.String(255), nullable=False),
        sa.Column("target_type",   sa.String(20),  nullable=False),
        sa.Column("target_id",     sa.String(36),  nullable=True),
        sa.Column("target_name",   sa.String(255), nullable=False),
        sa.Column("rating",        sa.Integer(),   nullable=False),
        sa.Column("comment",       sa.Text(),      nullable=True),
        sa.Column("is_public",     sa.Boolean(),   default=True),
        sa.Column("active",        sa.Boolean(),   default=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",    sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by",    sa.String(36),  nullable=True),
    )
    op.create_index("idx_review_project", "reviews", ["project_id"])
    op.create_index("idx_review_target",  "reviews", ["target_type", "target_id"])

    # ── guide_availabilities ───────────────────────────────────────
    op.create_table(
        "guide_availabilities",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("guide_id",   sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date",       sa.String(10), nullable=False),
        sa.Column("status",     sa.String(20), nullable=False, server_default="available"),
        sa.Column("project_id", sa.String(36), nullable=True),
        sa.Column("notes",      sa.Text(),     nullable=True),
        sa.Column("active",     sa.Boolean(),  default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by", sa.String(36), nullable=True),
    )
    op.create_index("idx_guide_avail_date", "guide_availabilities", ["guide_id", "date"])

    # ── circuit_remarks ────────────────────────────────────────────
    op.create_table(
        "circuit_remarks",
        sa.Column("id",                sa.String(36),  primary_key=True),
        sa.Column("guide_id",          sa.String(36),  sa.ForeignKey("users.id",     ondelete="CASCADE"), nullable=False),
        sa.Column("guide_name",        sa.String(255), nullable=False),
        sa.Column("project_id",        sa.String(36),  sa.ForeignKey("projects.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("itinerary_day_id",  sa.String(36),  nullable=True),
        sa.Column("day_number",        sa.Integer(),   nullable=True),
        sa.Column("remark_type",       sa.String(20),  nullable=False, server_default="observation"),
        sa.Column("content",           sa.Text(),      nullable=False),
        sa.Column("is_resolved",       sa.Boolean(),   default=False),
        sa.Column("active",            sa.Boolean(),   default=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",        sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by",        sa.String(36),  nullable=True),
    )
    op.create_index("idx_remark_project", "circuit_remarks", ["project_id"])

    # ── notifications ──────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id",           sa.String(36),  primary_key=True),
        sa.Column("recipient_id", sa.String(36),  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id",   sa.String(36),  nullable=True),
        sa.Column("sender_name",  sa.String(255), nullable=False),
        sa.Column("type",         sa.String(30),  nullable=False),
        sa.Column("title",        sa.String(255), nullable=False),
        sa.Column("message",      sa.Text(),      nullable=False),
        sa.Column("is_read",      sa.Boolean(),   default=False),
        sa.Column("extra",        sa.JSON(),      nullable=True),
        sa.Column("active",       sa.Boolean(),   default=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by",   sa.String(36),  nullable=True),
    )
    op.create_index("idx_notif_recipient_unread", "notifications", ["recipient_id", "is_read"])


def downgrade():
    op.drop_table("notifications")
    op.drop_table("circuit_remarks")
    op.drop_table("guide_availabilities")
    op.drop_table("reviews")
