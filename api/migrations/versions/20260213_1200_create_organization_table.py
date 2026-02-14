"""create organization table

Revision ID: 20260213_1200
Revises: 7fad73844bdd
Create Date: 2026-02-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260213_1200'
down_revision = '7fad73844bdd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='組織ID'),
        sa.Column('name', sa.String(length=200), nullable=False, comment='組織名'),
        sa.Column('address', sa.String(length=500), nullable=False, comment='住所'),
        sa.Column('phone_number', sa.String(length=20), nullable=False, comment='電話番号'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='作成日時'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='更新日時'),
        sa.PrimaryKeyConstraint('id'),
        comment='組織・企業テーブル'
    )
    op.create_index(op.f('ix_organizations_id'), 'organizations', ['id'], unique=False)

    # Add organization_id to consumers table
    op.add_column('consumers', sa.Column('organization_id', sa.Integer(), nullable=True, comment='所属組織ID'))
    op.create_foreign_key(None, 'consumers', 'organizations', ['organization_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'consumers', type_='foreignkey')
    op.drop_column('consumers', 'organization_id')
    op.drop_index(op.f('ix_organizations_id'), table_name='organizations')
    op.drop_table('organizations')
