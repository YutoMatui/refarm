"""make_consumer_address_optional

Revision ID: 92f284bc4776
Revises: 9e7f8a9b0c1d
Create Date: 2026-01-17 16:21:57.531414+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92f284bc4776'
down_revision: Union[str, None] = '9e7f8a9b0c1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.alter_column('consumers', 'postal_code',
               existing_type=sa.String(length=10),
               nullable=True)
    op.alter_column('consumers', 'address',
               existing_type=sa.String(length=500),
               nullable=True)


def downgrade() -> None:
    """Downgrade database schema."""
    op.alter_column('consumers', 'address',
               existing_type=sa.String(length=500),
               nullable=False)
    op.alter_column('consumers', 'postal_code',
               existing_type=sa.String(length=10),
               nullable=False)
