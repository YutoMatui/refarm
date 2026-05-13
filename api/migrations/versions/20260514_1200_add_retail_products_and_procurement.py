"""add retail_products and procurement tables for B2C intermediary model

Revision ID: 20260514_1200
Revises: 20260508_1300
Create Date: 2026-05-14 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260514_1200'
down_revision = '20260508_1300'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- retail_products ---
    op.create_table(
        'retail_products',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source_product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False, comment='仕入れ元の農家商品'),
        sa.Column('name', sa.String(200), nullable=False, comment='消費者向け商品名'),
        sa.Column('description', sa.Text(), nullable=True, comment='消費者向け説明文'),
        sa.Column('retail_price', sa.Numeric(10, 2), nullable=False, comment='小売価格（税抜）'),
        sa.Column('tax_rate', sa.Integer(), nullable=False, server_default='8', comment='税率'),
        sa.Column('retail_unit', sa.String(20), nullable=False, server_default='パック', comment='販売単位'),
        sa.Column('retail_quantity_label', sa.String(50), nullable=True, comment='表示用ラベル（3個入り等）'),
        sa.Column('conversion_factor', sa.Numeric(10, 4), nullable=False, server_default='1.0', comment='農家1単位あたりの小売数量'),
        sa.Column('waste_margin_pct', sa.Integer(), nullable=False, server_default='20', comment='廃棄マージン%'),
        sa.Column('image_url', sa.String(500), nullable=True, comment='商品画像URL'),
        sa.Column('category', sa.String(20), nullable=True, comment='カテゴリ'),
        sa.Column('is_active', sa.Integer(), nullable=False, server_default='1', comment='販売中フラグ'),
        sa.Column('is_featured', sa.Integer(), nullable=False, server_default='0', comment='おすすめフラグ'),
        sa.Column('is_wakeari', sa.Integer(), nullable=False, server_default='0', comment='訳ありフラグ'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0', comment='表示順'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_retail_products_id', 'retail_products', ['id'])
    op.create_index('ix_retail_products_source_product_id', 'retail_products', ['source_product_id'])

    # --- procurement_batches ---
    op.create_table(
        'procurement_batches',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('delivery_slot_id', sa.Integer(), sa.ForeignKey('delivery_slots.id', ondelete='SET NULL'), nullable=True, comment='対象配送スロット'),
        sa.Column('status', sa.String(20), nullable=False, server_default='COLLECTING', comment='ステータス'),
        sa.Column('cutoff_at', sa.DateTime(timezone=True), nullable=True, comment='注文締切日時'),
        sa.Column('aggregated_at', sa.DateTime(timezone=True), nullable=True, comment='集計実行日時'),
        sa.Column('ordered_at', sa.DateTime(timezone=True), nullable=True, comment='農家発注日時'),
        sa.Column('notes', sa.Text(), nullable=True, comment='メモ'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_procurement_batches_id', 'procurement_batches', ['id'])
    op.create_index('ix_procurement_batches_delivery_slot_id', 'procurement_batches', ['delivery_slot_id'])

    # --- procurement_items ---
    op.create_table(
        'procurement_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('batch_id', sa.Integer(), sa.ForeignKey('procurement_batches.id', ondelete='CASCADE'), nullable=False, comment='バッチID'),
        sa.Column('source_product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False, comment='農家商品'),
        sa.Column('retail_product_id', sa.Integer(), sa.ForeignKey('retail_products.id', ondelete='RESTRICT'), nullable=False, comment='小売商品'),
        sa.Column('total_retail_qty', sa.Integer(), nullable=False, server_default='0', comment='消費者注文合計（小売単位）'),
        sa.Column('calculated_farmer_qty', sa.Numeric(10, 2), nullable=False, server_default='0', comment='計算上の農家単位数'),
        sa.Column('ordered_farmer_qty', sa.Integer(), nullable=False, server_default='0', comment='実際発注数'),
        sa.Column('unit_cost', sa.Numeric(10, 2), nullable=True, comment='仕入値スナップショット'),
        sa.Column('notes', sa.Text(), nullable=True, comment='メモ'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_procurement_items_batch_id', 'procurement_items', ['batch_id'])

    # --- consumer_order_items に retail_product_id を追加 ---
    op.add_column('consumer_order_items', sa.Column(
        'retail_product_id', sa.Integer(),
        sa.ForeignKey('retail_products.id', ondelete='RESTRICT'),
        nullable=True, comment='小売商品ID'
    ))
    # product_id を nullable に変更（既存データ保護）
    op.alter_column('consumer_order_items', 'product_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('consumer_order_items', 'product_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('consumer_order_items', 'retail_product_id')
    op.drop_index('ix_procurement_items_batch_id', table_name='procurement_items')
    op.drop_table('procurement_items')
    op.drop_index('ix_procurement_batches_delivery_slot_id', table_name='procurement_batches')
    op.drop_index('ix_procurement_batches_id', table_name='procurement_batches')
    op.drop_table('procurement_batches')
    op.drop_index('ix_retail_products_source_product_id', table_name='retail_products')
    op.drop_index('ix_retail_products_id', table_name='retail_products')
    op.drop_table('retail_products')
