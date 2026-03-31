"""add settlement skip fields

Revision ID: 20260401_1200
Revises: 20260331_1200
Create Date: 2026-04-01 12:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260401_1200"
down_revision: Union[str, None] = "20260331_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("settlement_statuses", sa.Column("skip_reason", sa.String(length=50), nullable=True, comment="スキップ理由"))
    op.add_column("settlement_statuses", sa.Column("skip_note", sa.String(length=500), nullable=True, comment="スキップ備考"))
    op.add_column("settlement_statuses", sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True, comment="LINE送信日時"))


def downgrade() -> None:
    op.drop_column("settlement_statuses", "notified_at")
    op.drop_column("settlement_statuses", "skip_note")
    op.drop_column("settlement_statuses", "skip_reason")
