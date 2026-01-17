"""add_support_message_table

Revision ID: b29988a2a962
Revises: 92f284bc4776
Create Date: 2026-01-17 18:42:54.080548+09:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b29988a2a962'
down_revision: Union[str, None] = '92f284bc4776'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create support_messages table
    op.create_table('support_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('consumer_id', sa.Integer(), nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('nickname', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['consumer_id'], ['consumers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_support_messages_id'), 'support_messages', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f('ix_support_messages_id'), table_name='support_messages')
    op.drop_table('support_messages')
