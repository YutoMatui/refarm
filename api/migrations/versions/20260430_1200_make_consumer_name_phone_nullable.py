"""make consumer name and phone_number nullable for lazy registration

Revision ID: 20260430_1200
Revises: 20260401_1200
Create Date: 2026-04-30 12:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260430_1200"
down_revision: Union[str, None] = "20260401_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # name と phone_number を nullable に変更（LINE IDだけで仮登録可能に）
    op.alter_column('consumers', 'name',
                     existing_type=sa.String(200),
                     nullable=True)
    op.alter_column('consumers', 'phone_number',
                     existing_type=sa.String(20),
                     nullable=True)


def downgrade() -> None:
    # デフォルト値を設定してからnot nullに戻す
    op.execute("UPDATE consumers SET name = '未登録' WHERE name IS NULL")
    op.execute("UPDATE consumers SET phone_number = '0000000000' WHERE phone_number IS NULL")
    op.alter_column('consumers', 'name',
                     existing_type=sa.String(200),
                     nullable=False)
    op.alter_column('consumers', 'phone_number',
                     existing_type=sa.String(20),
                     nullable=False)
