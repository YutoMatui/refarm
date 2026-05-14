"""add is_consumer_visible flag to products table

Revision ID: 20260515_1400
Revises: 20260515_1200
Create Date: 2026-05-15 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260515_1400'
down_revision = '20260515_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column(
        'is_consumer_visible', sa.Integer(), nullable=False, server_default='0',
        comment='消費者向け表示フラグ (0: 非表示, 1: 表示)'
    ))


def downgrade() -> None:
    op.drop_column('products', 'is_consumer_visible')
