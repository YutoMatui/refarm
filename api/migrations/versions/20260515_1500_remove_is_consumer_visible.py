"""remove is_consumer_visible column added by 20260515_1400

Revision ID: 20260515_1500
Revises: 20260515_1400
Create Date: 2026-05-15 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260515_1500'
down_revision = '20260515_1400'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # is_consumer_visible カラムが存在する場合のみ削除
    try:
        op.drop_column('products', 'is_consumer_visible')
    except Exception:
        pass  # カラムが存在しない場合はスキップ


def downgrade() -> None:
    op.add_column('products', sa.Column(
        'is_consumer_visible', sa.Integer(), nullable=False, server_default='0',
        comment='消費者向け表示フラグ (0: 非表示, 1: 表示)'
    ))
