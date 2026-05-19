"""add is_medama to retail_products

Revision ID: 20260518_1500
Revises: 20260518_1400
Create Date: 2026-05-18 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260518_1500'
down_revision = '20260518_1400'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # カラムが既に存在する場合はスキップ（create_allで先に作られた場合の対策）
    try:
        op.add_column('retail_products', sa.Column(
            'is_medama', sa.Integer(), nullable=False, server_default='0',
            comment='目玉商品フラグ'
        ))
    except Exception:
        pass

    # NULLが残っている場合に0で埋める
    op.execute("UPDATE retail_products SET is_medama = 0 WHERE is_medama IS NULL")


def downgrade() -> None:
    try:
        op.drop_column('retail_products', 'is_medama')
    except Exception:
        pass
