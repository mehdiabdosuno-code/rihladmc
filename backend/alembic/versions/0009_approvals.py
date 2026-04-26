"""Approval Workflow: rules, requests, steps.

Revision ID: 0009_approvals
Revises: 0008_contracting
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0009_approvals"
down_revision = "0008_contracting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("conditions", sa.JSON()),
        sa.Column("mode", sa.String(16), nullable=False, server_default="sequential"),
        sa.Column("approvers", sa.JSON()),
        sa.Column("sla_hours", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_approval_rule_company_entity", "approval_rules", ["company_id", "entity_type"])
    op.create_index("ix_approval_rules_company_id", "approval_rules", ["company_id"])
    op.create_index("ix_approval_rules_entity_type", "approval_rules", ["entity_type"])
    op.create_index("ix_approval_rules_is_active", "approval_rules", ["is_active"])

    op.create_table(
        "approval_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36),
                  sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", sa.String(36),
                  sa.ForeignKey("approval_rules.id", ondelete="SET NULL")),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("submitted_by", sa.String(36),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("snapshot", sa.JSON()),
        sa.Column("note", sa.String(2000)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("idx_approval_req_entity", "approval_requests", ["entity_type", "entity_id"])
    op.create_index("idx_approval_req_status", "approval_requests", ["company_id", "status"])
    op.create_index("ix_approval_requests_company_id", "approval_requests", ["company_id"])
    op.create_index("ix_approval_requests_entity_type", "approval_requests", ["entity_type"])
    op.create_index("ix_approval_requests_entity_id", "approval_requests", ["entity_id"])
    op.create_index("ix_approval_requests_status", "approval_requests", ["status"])

    op.create_table(
        "approval_steps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(36),
                  sa.ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("approver_role", sa.String(50)),
        sa.Column("approver_user_id", sa.String(36),
                  sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("decided_at", sa.String(40)),
        sa.Column("decided_by", sa.String(36)),
        sa.Column("comment", sa.String(2000)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("created_by", sa.String(36)),
        sa.Column("active", sa.Boolean(), default=True),
    )
    op.create_index("ix_approval_steps_request_id", "approval_steps", ["request_id"])
    op.create_index("ix_approval_steps_position", "approval_steps", ["position"])


def downgrade() -> None:
    op.drop_table("approval_steps")
    op.drop_table("approval_requests")
    op.drop_table("approval_rules")
