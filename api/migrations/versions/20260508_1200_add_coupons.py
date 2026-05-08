"""add coupons table and coupon fields to consumer_orders

Revision ID: 20260508_1200
Revises: 20260430_1200_make_consumer_name_phone_nullable
Create Date: 2026-05-08 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260508_1200'
down_revision = '20260430_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'coupons',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('description', sa.String(200), nullable=True),
        sa.Column('discount_type', sa.Enum('percentage', 'fixed_amount', name='discounttype'), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('min_order_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('used_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_coupons_id', 'coupons', ['id'])
    op.create_index('ix_coupons_code', 'coupons', ['code'], unique=True)

    op.add_column('consumer_orders', sa.Column('coupon_code', sa.String(50), nullable=True))
    op.add_column('consumer_orders', sa.Column('discount_amount', sa.Numeric(10, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('consumer_orders', 'discount_amount')
    op.drop_column('consumer_orders', 'coupon_code')
    op.drop_index('ix_coupons_code', table_name='coupons')
    op.drop_index('ix_coupons_id', table_name='coupons')
    op.drop_table('coupons')
    op.execute("DROP TYPE IF EXISTS discounttype")
