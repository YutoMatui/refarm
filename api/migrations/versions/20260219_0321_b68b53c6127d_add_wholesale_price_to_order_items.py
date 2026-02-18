"""add wholesale_price to order_items

Revision ID: b68b53c6127d
Revises: 20260213_1200
Create Date: 2026-02-19 03:21:57.163283+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b68b53c6127d'
down_revision: Union[str, None] = '20260213_1200'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add wholesale_price column
    op.add_column('order_items', sa.Column('wholesale_price', sa.Numeric(precision=10, scale=2), nullable=True, comment='卸値 (税抜・スナップショット)'))
    
    # Populate existing rows from products.cost_price
    op.execute("""
        UPDATE order_items 
        SET wholesale_price = products.cost_price
        FROM products
        WHERE order_items.product_id = products.id
    """)
    
    # Fallback if cost_price was null: use unit_price * 0.8 / 1.08 (rounded)
    op.execute("""
        UPDATE order_items
        SET wholesale_price = ROUND(unit_price * 0.8 / 1.08)
        WHERE wholesale_price IS NULL
    """)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column('order_items', 'wholesale_price')
