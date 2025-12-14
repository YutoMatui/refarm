"""add_producer_columns

Revision ID: add_producer_cols_001
Revises: 20e869140d4e
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_producer_cols_001'
down_revision: Union[str, None] = '20e869140d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite互換性を考慮したカラム追加
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(sa.Column('cost_price', sa.Integer(), nullable=True, comment='仕入れ値'))
        batch_op.add_column(sa.Column('harvest_status', sa.String(), nullable=True, comment='収穫状況'))


def downgrade() -> None:
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('harvest_status')
        batch_op.drop_column('cost_price')
