"""add image_urls JSON array to retail_products

Revision ID: 20260518_1300
Revises: 20260518_1200
Create Date: 2026-05-18 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260518_1300'
down_revision = '20260518_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column('retail_products', sa.Column(
            'image_urls',
            sa.JSON(),
            nullable=True,
            comment='商品画像URL配列'
        ))
    except Exception:
        pass
    # 既存の image_url を image_urls に移行
    op.execute("""
        UPDATE retail_products
        SET image_urls = CASE
            WHEN image_url IS NOT NULL AND image_url != '' THEN json_build_array(image_url)
            ELSE '[]'::json
        END
        WHERE image_urls IS NULL
    """)


def downgrade() -> None:
    try:
        op.drop_column('retail_products', 'image_urls')
    except Exception:
        pass
