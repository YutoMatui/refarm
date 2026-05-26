"""add is_active to consumers for blocking

Revision ID: 20260527_1200
Revises: 20260525_1200
Create Date: 2026-05-27 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260527_1200'
down_revision = '20260525_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('consumers', sa.Column(
        'is_active', sa.Integer(), nullable=False, server_default='1',
        comment='アクティブフラグ (0: ブロック, 1: 有効)'
    ))


def downgrade() -> None:
    op.drop_column('consumers', 'is_active')
