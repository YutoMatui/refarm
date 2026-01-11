"""add bank info to farmers

Revision ID: 004_add_bank_info
Revises: add_guest_tables_003
Create Date: 2026-01-11 16:51:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_bank_info'
down_revision = 'add_guest_003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add bank information columns to farmers table
    op.add_column('farmers', sa.Column('bank_name', sa.String(length=100), nullable=True, comment='銀行名'))
    op.add_column('farmers', sa.Column('bank_branch', sa.String(length=100), nullable=True, comment='支店名'))
    op.add_column('farmers', sa.Column('bank_account_type', sa.String(length=10), nullable=True, comment='口座種別 (普通/当座)'))
    op.add_column('farmers', sa.Column('bank_account_number', sa.String(length=20), nullable=True, comment='口座番号'))
    op.add_column('farmers', sa.Column('bank_account_holder', sa.String(length=100), nullable=True, comment='口座名義'))


def downgrade() -> None:
    # Remove bank information columns from farmers table
    op.drop_column('farmers', 'bank_account_holder')
    op.drop_column('farmers', 'bank_account_number')
    op.drop_column('farmers', 'bank_account_type')
    op.drop_column('farmers', 'bank_branch')
    op.drop_column('farmers', 'bank_name')
