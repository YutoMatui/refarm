"""Update deliveryslottype ENUM: UNIV -> UNIVERSITY

Revision ID: 8d6e7f8a9b0c
Revises: 7c5f6a1b2d3e
Create Date: 2026-01-17 15:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d6e7f8a9b0c'
down_revision: Union[str, None] = '007_add_shipping_fee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Step 1: 新しい値 'UNIVERSITY' を既存のENUM型に追加
    op.execute("""
        ALTER TYPE deliveryslottype ADD VALUE IF NOT EXISTS 'UNIVERSITY';
    """)


def downgrade() -> None:
    """Downgrade database schema."""
    # ENUM値の削除は複雑なため、ダウングレードでは何もしません
    pass
