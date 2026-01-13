"""Add consumer tables for B2C flow

Revision ID: 7c5f6a1b2d3e
Revises: 006_add_analytics_tables
Create Date: 2026-01-13 13:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c5f6a1b2d3e'
down_revision: Union[str, None] = '006_add_analytics_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliveryslottype') THEN
                CREATE TYPE deliveryslottype AS ENUM ('HOME', 'UNIV');
            END IF;
        END$$;
    """)
    delivery_slot_type_enum = sa.Enum('HOME', 'UNIV', name='deliveryslottype', create_type=False)

    op.create_table(
        'consumers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='消費者ID'),
        sa.Column('line_user_id', sa.String(length=128), nullable=False, comment='LINE User ID'),
        sa.Column('name', sa.String(length=200), nullable=False, comment='氏名'),
        sa.Column('phone_number', sa.String(length=20), nullable=False, comment='電話番号'),
        sa.Column('postal_code', sa.String(length=10), nullable=False, comment='郵便番号'),
        sa.Column('address', sa.String(length=500), nullable=False, comment='住所'),
        sa.Column('building', sa.String(length=255), nullable=True, comment='建物名・部屋番号'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='更新日時'),
        sa.PrimaryKeyConstraint('id'),
        comment='一般消費者テーブル'
    )
    op.create_index('ix_consumers_line_user_id', 'consumers', ['line_user_id'], unique=True)

    op.create_table(
        'delivery_slots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='受取枠ID'),
        sa.Column('date', sa.Date(), nullable=False, comment='対象日'),
        sa.Column('slot_type', delivery_slot_type_enum, nullable=False, comment='枠種別 (HOME/UNIV)'),
        sa.Column('start_time', sa.Time(), nullable=True, comment='開始時刻'),
        sa.Column('end_time', sa.Time(), nullable=True, comment='終了時刻'),
        sa.Column('time_text', sa.String(length=120), nullable=False, comment='表示用時間テキスト'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='公開フラグ'),
        sa.Column('note', sa.String(length=255), nullable=True, comment='備考'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='更新日時'),
        sa.PrimaryKeyConstraint('id'),
        comment='B2C受取枠テーブル'
    )
    op.create_index('ix_delivery_slots_date', 'delivery_slots', ['date'], unique=False)
    op.create_index('ix_delivery_slots_date_type', 'delivery_slots', ['date', 'slot_type'], unique=False)

    order_status_enum = sa.Enum(
        'PENDING',
        'CONFIRMED',
        'PREPARING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        name='orderstatus',
        create_type=False
    )

    op.create_table(
        'consumer_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='注文ID'),
        sa.Column('consumer_id', sa.Integer(), nullable=False, comment='消費者ID'),
        sa.Column('delivery_slot_id', sa.Integer(), nullable=True, comment='受取枠ID'),
        sa.Column('delivery_type', delivery_slot_type_enum, nullable=False, comment='受取方法'),
        sa.Column('delivery_label', sa.String(length=120), nullable=False, comment='受取方法表示名'),
        sa.Column('delivery_time_label', sa.String(length=120), nullable=False, comment='受取時間表示名'),
        sa.Column('delivery_address', sa.String(length=500), nullable=True, comment='配送住所'),
        sa.Column('delivery_notes', sa.Text(), nullable=True, comment='受取メモ'),
        sa.Column('payment_method', sa.String(length=50), nullable=False, server_default=sa.text("'cash_on_delivery'"), comment='支払方法'),
        sa.Column('order_notes', sa.Text(), nullable=True, comment='注文メモ'),
        sa.Column('status', order_status_enum, nullable=False, server_default=sa.text("'pending'"), comment='注文ステータス'),
        sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text('0'), comment='商品小計'),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text('0'), comment='消費税額'),
        sa.Column('shipping_fee', sa.Integer(), nullable=False, server_default=sa.text('0'), comment='送料'),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text('0'), comment='支払総額'),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True, comment='注文確定日時'),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True, comment='受け渡し完了日時'),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True, comment='キャンセル日時'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='更新日時'),
        sa.ForeignKeyConstraint(['consumer_id'], ['consumers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['delivery_slot_id'], ['delivery_slots.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        comment='一般消費者向け注文テーブル'
    )
    op.create_index('ix_consumer_orders_consumer_id', 'consumer_orders', ['consumer_id'], unique=False)
    op.create_index('ix_consumer_orders_consumer_status', 'consumer_orders', ['consumer_id', 'status'], unique=False)
    op.create_index('ix_consumer_orders_status', 'consumer_orders', ['status'], unique=False)

    op.create_table(
        'consumer_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='注文明細ID'),
        sa.Column('order_id', sa.Integer(), nullable=False, comment='注文ID'),
        sa.Column('product_id', sa.Integer(), nullable=False, comment='商品ID'),
        sa.Column('quantity', sa.Integer(), nullable=False, comment='数量'),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False, comment='単価'),
        sa.Column('tax_rate', sa.Integer(), nullable=False, comment='税率'),
        sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False, comment='税抜小計'),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False, comment='消費税額'),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False, comment='税込金額'),
        sa.Column('product_name', sa.String(length=200), nullable=False, comment='商品名スナップショット'),
        sa.Column('product_unit', sa.String(length=20), nullable=False, comment='単位スナップショット'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False, comment='更新日時'),
        sa.ForeignKeyConstraint(['order_id'], ['consumer_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        comment='一般消費者向け注文明細テーブル'
    )
    op.create_index('ix_consumer_order_items_order_id', 'consumer_order_items', ['order_id'], unique=False)
    op.create_index('ix_consumer_order_items_product_id', 'consumer_order_items', ['product_id'], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index('ix_consumer_order_items_product_id', table_name='consumer_order_items')
    op.drop_index('ix_consumer_order_items_order_id', table_name='consumer_order_items')
    op.drop_table('consumer_order_items')

    op.drop_index('ix_consumer_orders_status', table_name='consumer_orders')
    op.drop_index('ix_consumer_orders_consumer_status', table_name='consumer_orders')
    op.drop_index('ix_consumer_orders_consumer_id', table_name='consumer_orders')
    op.drop_table('consumer_orders')

    op.drop_index('ix_delivery_slots_date_type', table_name='delivery_slots')
    op.drop_index('ix_delivery_slots_date', table_name='delivery_slots')
    op.drop_table('delivery_slots')

    op.drop_index('ix_consumers_line_user_id', table_name='consumers')
    op.drop_table('consumers')

    delivery_slot_type_enum = sa.Enum('HOME', 'UNIV', name='deliveryslottype')
    delivery_slot_type_enum.drop(op.get_bind(), checkfirst=True)