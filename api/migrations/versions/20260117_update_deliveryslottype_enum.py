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
down_revision: Union[str, None] = '7c5f6a1b2d3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # PostgreSQLのENUM型の値を変更するには、以下の手順が必要:
    # 1. 新しい値を既存のENUM型に追加
    # 2. 既存のデータを新しい値に更新
    # 3. 古い値を削除
    
    # Step 1: 新しい値 'UNIVERSITY' を既存のENUM型に追加
    op.execute("""
        ALTER TYPE deliveryslottype ADD VALUE IF NOT EXISTS 'UNIVERSITY';
    """)
    
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
    
    # 注意: PostgreSQLのENUM型から値を削除するには、
    # ENUM型を再作成する必要があり、これは複雑です。
    # 'UNIV'値を残しておくことで、ロールバックが容易になります。
    # もし完全に削除したい場合は、以下のコメントアウトされた
    # コードを使用してください（ただし、ダウンタイムが発生します）。
    
    # ENUM値を完全に削除する場合（非推奨）:
    # op.execute("""
    #     ALTER TYPE deliveryslottype RENAME TO deliveryslottype_old;
    #     CREATE TYPE deliveryslottype AS ENUM ('HOME', 'UNIVERSITY');
    #     ALTER TABLE delivery_slots ALTER COLUMN slot_type TYPE deliveryslottype USING slot_type::text::deliveryslottype;
    #     ALTER TABLE consumer_orders ALTER COLUMN delivery_type TYPE deliveryslottype USING delivery_type::text::deliveryslottype;
    #     DROP TYPE deliveryslottype_old;
    # """)


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
    
    # 注意: ENUM値の完全な削除はダウングレードでは行いません
