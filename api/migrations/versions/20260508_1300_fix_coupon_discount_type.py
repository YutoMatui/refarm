"""fix coupon discount_type from enum to varchar

Revision ID: 20260508_1300
Revises: 20260508_1200
Create Date: 2026-05-08 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260508_1300'
down_revision = '20260508_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change discount_type column from enum to varchar
    op.execute("ALTER TABLE coupons ALTER COLUMN discount_type TYPE VARCHAR(20) USING discount_type::text")
    op.execute("DROP TYPE IF EXISTS discounttype")


def downgrade() -> None:
    op.execute("CREATE TYPE discounttype AS ENUM ('percentage', 'fixed_amount')")
    op.execute("ALTER TABLE coupons ALTER COLUMN discount_type TYPE discounttype USING discount_type::discounttype")
