"""add set_quantity to retail_products for bundle/set sales

Revision ID: 20260518_1400
Revises: 20260518_1300
Create Date: 2026-05-18 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260518_1400'
down_revision = '20260518_1300'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('retail_products', sa.Column(
        'set_quantity',
        sa.Integer(),
        nullable=False,
        server_default='1',
        comment='セット数量（1=バラ売り, 2以上=セット売り）'
    ))


def downgrade() -> None:
    op.drop_column('retail_products', 'set_quantity')
