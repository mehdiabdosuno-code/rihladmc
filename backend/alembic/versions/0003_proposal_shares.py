"""proposal_shares and proposal_comments tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'proposal_shares',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('token', sa.String(36), unique=True, nullable=False, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_accepted', sa.Boolean(), default=False, nullable=False),
        sa.Column('views', sa.Integer(), default=0, nullable=False),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('client_email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        'proposal_comments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('share_id', sa.String(36), sa.ForeignKey('proposal_shares.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('author_name', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('proposal_comments')
    op.drop_table('proposal_shares')
