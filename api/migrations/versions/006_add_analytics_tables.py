"""add analytics tables

Revision ID: 006_add_analytics_tables
Revises: 005_make_farmer_id_nullable
Create Date: 2026-01-12 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_add_analytics_tables'
down_revision = '005_make_farmer_id_nullable'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add visitor_id to guest_visits
    op.add_column('guest_visits', sa.Column('visitor_id', sa.String(length=100), nullable=True, comment='訪問者ID (Cookie/UUID)'))
    op.create_index(op.f('ix_guest_visits_visitor_id'), 'guest_visits', ['visitor_id'], unique=False)

    # 2. Create farmer_follows table
    op.create_table('farmer_follows',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('restaurant_id', 'farmer_id', name='uq_farmer_follow')
    )
    op.create_index(op.f('ix_farmer_follows_farmer_id'), 'farmer_follows', ['farmer_id'], unique=False)
    op.create_index(op.f('ix_farmer_follows_restaurant_id'), 'farmer_follows', ['restaurant_id'], unique=False)

    # 3. Reset reactions (truncate guest_interactions)
    op.execute('TRUNCATE TABLE guest_interactions RESTART IDENTITY CASCADE')


def downgrade() -> None:
    # 1. Drop farmer_follows
    op.drop_index(op.f('ix_farmer_follows_restaurant_id'), table_name='farmer_follows')
    op.drop_index(op.f('ix_farmer_follows_farmer_id'), table_name='farmer_follows')
    op.drop_table('farmer_follows')

    # 2. Remove visitor_id from guest_visits
    op.drop_index(op.f('ix_guest_visits_visitor_id'), table_name='guest_visits')
    op.drop_column('guest_visits', 'visitor_id')
