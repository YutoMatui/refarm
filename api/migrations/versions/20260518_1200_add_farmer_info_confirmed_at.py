"""add info_confirmed_at to farmers table

Revision ID: 20260518_1200
Revises: 20260515_1500
Create Date: 2026-05-18 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260518_1200'
down_revision = '20260515_1500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('farmers', sa.Column(
        'info_confirmed_at',
        sa.DateTime(timezone=True),
        nullable=True,
        server_default=sa.func.now(),
        comment='最新情報が確認/更新された日時'
    ))
    # 既存レコードに現在時刻をセット
    op.execute("UPDATE farmers SET info_confirmed_at = NOW() WHERE info_confirmed_at IS NULL")


def downgrade() -> None:
    op.drop_column('farmers', 'info_confirmed_at')
