"""add delivery_date to procurement_batches, b2b_direct_qty to procurement_items,
make retail_product_id nullable for unified B2B+B2C procurement

Revision ID: 20260515_1200
Revises: 20260514_1200
Create Date: 2026-05-15 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260515_1200'
down_revision = '20260514_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # procurement_batches: delivery_date 追加
    op.add_column('procurement_batches', sa.Column(
        'delivery_date', sa.Date(), nullable=True, comment='対象配送日'
    ))
    op.create_index('ix_procurement_batches_delivery_date', 'procurement_batches', ['delivery_date'])

    # procurement_items: retail_product_id を nullable に変更
    op.alter_column('procurement_items', 'retail_product_id',
                     existing_type=sa.Integer(), nullable=True)

    # procurement_items: b2b_direct_qty 追加
    op.add_column('procurement_items', sa.Column(
        'b2b_direct_qty', sa.Integer(), nullable=False, server_default='0',
        comment='B2B飲食店注文の直接数量'
    ))

    # 既存バッチの delivery_date を delivery_slots.date から埋める
    op.execute("""
        UPDATE procurement_batches
        SET delivery_date = ds.date
        FROM delivery_slots ds
        WHERE procurement_batches.delivery_slot_id = ds.id
          AND procurement_batches.delivery_date IS NULL
    """)


def downgrade() -> None:
    op.drop_column('procurement_items', 'b2b_direct_qty')
    op.alter_column('procurement_items', 'retail_product_id',
                     existing_type=sa.Integer(), nullable=False)
    op.drop_index('ix_procurement_batches_delivery_date', table_name='procurement_batches')
    op.drop_column('procurement_batches', 'delivery_date')
