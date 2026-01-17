"""Migrate deliveryslottype data: UNIV -> UNIVERSITY

Revision ID: 9e7f8a9b0c1d
Revises: 8d6e7f8a9b0c
Create Date: 2026-01-17 15:40:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e7f8a9b0c1d'
down_revision: Union[str, None] = '8d6e7f8a9b0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Step 2: 既存のデータを 'UNIV' から 'UNIVERSITY' に更新
    # delivery_slots テーブル
    op.execute("""
        UPDATE delivery_slots
        SET slot_type = 'UNIVERSITY'
        WHERE slot_type = 'UNIV';
    """)
    
    # consumer_orders テーブル
    op.execute("""
        UPDATE consumer_orders
        SET delivery_type = 'UNIVERSITY'
        WHERE delivery_type = 'UNIV';
    """)


def downgrade() -> None:
    """Downgrade database schema."""
    # ロールバック: 'UNIVERSITY' を 'UNIV' に戻す
    op.execute("""
        UPDATE delivery_slots
        SET slot_type = 'UNIV'
        WHERE slot_type = 'UNIVERSITY';
    """)
    
    op.execute("""
        UPDATE consumer_orders
        SET delivery_type = 'UNIV'
        WHERE delivery_type = 'UNIVERSITY';
    """)
