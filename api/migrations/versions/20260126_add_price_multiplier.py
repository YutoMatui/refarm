"""add price_multiplier to products

Revision ID: 20260126_price_mult
Revises: 20260119_2306_ff4a877946e5
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import Numeric


# revision identifiers, used by Alembic.
revision = '20260126_price_mult'
down_revision = 'ff4a877946e5'
branch_labels = None
depends_on = None


def upgrade():
    # Add price_multiplier column to products table with default 0.8
    op.add_column('products', sa.Column('price_multiplier', Numeric(4, 2), nullable=False, server_default='0.8', comment='価格調整係数 (仕入れ値 ÷ この値 × 1.08で販売価格を算出)'))


def downgrade():
    # Remove price_multiplier column
    op.drop_column('products', 'price_multiplier')
