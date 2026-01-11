"""make_farmer_id_nullable

Revision ID: 005_make_farmer_id_nullable
Revises: 004_add_bank_info
Create Date: 2026-01-11 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_make_farmer_id_nullable'
down_revision = '004_add_bank_info'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make farmer_id nullable in guest_interactions
    with op.batch_alter_table('guest_interactions') as batch_op:
        batch_op.alter_column('farmer_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    # Revert farmer_id to not nullable
    with op.batch_alter_table('guest_interactions') as batch_op:
        batch_op.alter_column('farmer_id',
               existing_type=sa.INTEGER(),
               nullable=False)
