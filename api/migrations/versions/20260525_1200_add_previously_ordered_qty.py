"""add previously_ordered_qty to procurement_items for re-order diff tracking

Revision ID: 20260525_1200
Revises: 20260520_1200
Create Date: 2026-05-25 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260525_1200'
down_revision = '20260520_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('procurement_items', sa.Column(
        'previously_ordered_qty', sa.Integer(), nullable=False, server_default='0',
        comment='前回発注済み数量（追加発注の差分計算用）'
    ))


def downgrade() -> None:
    op.drop_column('procurement_items', 'previously_ordered_qty')
