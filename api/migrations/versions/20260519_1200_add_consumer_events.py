"""add consumer_events table

Revision ID: 20260519_1200
Revises: 20260518_1500
Create Date: 2026-05-19 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260519_1200'
down_revision = '20260518_1500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'consumer_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('consumer_id', sa.Integer(), nullable=True, comment='消費者ID'),
        sa.Column('session_id', sa.String(64), nullable=True, comment='セッションID'),
        sa.Column('event_type', sa.String(50), nullable=False, comment='イベント種別'),
        sa.Column('page', sa.String(255), nullable=True, comment='ページパス'),
        sa.Column('product_id', sa.Integer(), nullable=True, comment='関連商品ID'),
        sa.Column('product_name', sa.String(200), nullable=True, comment='商品名スナップショット'),
        sa.Column('farmer_id', sa.Integer(), nullable=True, comment='関連農家ID'),
        sa.Column('farmer_name', sa.String(200), nullable=True, comment='農家名スナップショット'),
        sa.Column('quantity', sa.Integer(), nullable=True, comment='数量（カート操作時）'),
        sa.Column('search_query', sa.String(200), nullable=True, comment='検索キーワード'),
        sa.Column('cart_item_count', sa.Integer(), nullable=True, comment='カート内商品数'),
        sa.Column('cart_total', sa.Integer(), nullable=True, comment='カート合計金額'),
        sa.Column('metadata', sa.JSON(), nullable=True, comment='追加データ'),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, comment='更新日時'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['consumer_id'], ['consumers.id'], ondelete='SET NULL'),
        comment='消費者行動イベントログテーブル',
    )
    op.create_index('ix_consumer_events_id', 'consumer_events', ['id'])
    op.create_index('ix_consumer_events_consumer_id', 'consumer_events', ['consumer_id'])
    op.create_index('ix_consumer_events_session_id', 'consumer_events', ['session_id'])
    op.create_index('ix_consumer_events_event_type', 'consumer_events', ['event_type'])
    op.create_index('ix_consumer_events_product_id', 'consumer_events', ['product_id'])
    op.create_index('ix_consumer_events_type_created', 'consumer_events', ['event_type', 'created_at'])
    op.create_index('ix_consumer_events_consumer_type', 'consumer_events', ['consumer_id', 'event_type'])


def downgrade() -> None:
    op.drop_index('ix_consumer_events_consumer_type', table_name='consumer_events')
    op.drop_index('ix_consumer_events_type_created', table_name='consumer_events')
    op.drop_index('ix_consumer_events_product_id', table_name='consumer_events')
    op.drop_index('ix_consumer_events_event_type', table_name='consumer_events')
    op.drop_index('ix_consumer_events_session_id', table_name='consumer_events')
    op.drop_index('ix_consumer_events_consumer_id', table_name='consumer_events')
    op.drop_index('ix_consumer_events_id', table_name='consumer_events')
    op.drop_table('consumer_events')
