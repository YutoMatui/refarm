"""add_guest_tables

Revision ID: add_guest_003
Revises: add_producer_cols_001
Create Date: 2024-01-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_guest_003'
down_revision: Union[str, None] = 'add_producer_cols_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Guest Visits
    op.create_table(
        'guest_visits',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('stay_time_seconds', sa.Integer(), nullable=True, comment='滞在時間(秒)'),
        sa.Column('scroll_depth', sa.Integer(), nullable=True, comment='スクロール到達率(%)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='更新日時'),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_guest_visits_id'), 'guest_visits', ['id'], unique=False)
    op.create_index(op.f('ix_guest_visits_restaurant_id'), 'guest_visits', ['restaurant_id'], unique=False)

    # Guest Interactions
    op.create_table(
        'guest_interactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('visit_id', sa.Integer(), nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('interaction_type', sa.String(length=50), nullable=False, comment='アクションタイプ (STAMP, MESSAGE, INTEREST)'),
        sa.Column('stamp_type', sa.String(length=50), nullable=True, comment='スタンプの種類'),
        sa.Column('comment', sa.Text(), nullable=True, comment='応援メッセージ本文'),
        sa.Column('nickname', sa.String(length=100), nullable=True, comment='ニックネーム'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='更新日時'),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ),
        sa.ForeignKeyConstraint(['visit_id'], ['guest_visits.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_guest_interactions_farmer_id'), 'guest_interactions', ['farmer_id'], unique=False)
    op.create_index(op.f('ix_guest_interactions_id'), 'guest_interactions', ['id'], unique=False)
    op.create_index(op.f('ix_guest_interactions_visit_id'), 'guest_interactions', ['visit_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_guest_interactions_visit_id'), table_name='guest_interactions')
    op.drop_index(op.f('ix_guest_interactions_id'), table_name='guest_interactions')
    op.drop_index(op.f('ix_guest_interactions_farmer_id'), table_name='guest_interactions')
    op.drop_table('guest_interactions')
    op.drop_index(op.f('ix_guest_visits_restaurant_id'), table_name='guest_visits')
    op.drop_index(op.f('ix_guest_visits_id'), table_name='guest_visits')
    op.drop_table('guest_visits')
