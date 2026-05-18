"""add is_medama to retail_products

Revision ID: 20260518_1500
Revises: 20260518_1400
Create Date: 2026-05-18 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260518_1500'
down_revision = '20260518_1400'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('retail_products', sa.Column(
        'is_medama', sa.Integer(), nullable=False, server_default='0',
        comment='目玉商品フラグ'
    ))


def downgrade() -> None:
    op.drop_column('retail_products', 'is_medama')
