"""add shipping fee to orders

Revision ID: 007_add_shipping_fee
Revises: 7c5f6a1b2d3e
Create Date: 2026-01-17 15:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_shipping_fee'
down_revision = '7c5f6a1b2d3e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add shipping_fee column to orders table
    op.add_column('orders', sa.Column('shipping_fee', sa.Integer(), nullable=False, server_default=sa.text('0'), comment='配送料 (税込)'))


def downgrade() -> None:
    # Remove shipping_fee column from orders table
    op.drop_column('orders', 'shipping_fee')
