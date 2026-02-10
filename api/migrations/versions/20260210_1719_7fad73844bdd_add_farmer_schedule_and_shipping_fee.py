"""add_farmer_schedule_and_shipping_fee

Revision ID: 7fad73844bdd
Revises: 20260126_price_mult
Create Date: 2026-02-10 17:19:36.194541+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fad73844bdd'
down_revision: Union[str, None] = '20260126_price_mult'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create farmer_schedules table
    op.create_table(
        'farmer_schedules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('is_available', sa.Boolean(), nullable=False, default=True),
        sa.Column('notes', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_farmer_schedules_farmer_id'), 'farmer_schedules', ['farmer_id'], unique=False)
    op.create_index(op.f('ix_farmer_schedules_date'), 'farmer_schedules', ['date'], unique=False)

    # Add shipping_fee to restaurants
    op.add_column('restaurants', sa.Column('shipping_fee', sa.Integer(), nullable=False, server_default='800', comment='配送料 (税込)'))


def downgrade() -> None:
    # Drop shipping_fee from restaurants
    op.drop_column('restaurants', 'shipping_fee')
    
    # Drop farmer_schedules table
    op.drop_index(op.f('ix_farmer_schedules_date'), table_name='farmer_schedules')
    op.drop_index(op.f('ix_farmer_schedules_farmer_id'), table_name='farmer_schedules')
    op.drop_table('farmer_schedules')
