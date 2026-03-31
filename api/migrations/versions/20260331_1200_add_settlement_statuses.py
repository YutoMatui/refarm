"""add settlement statuses table

Revision ID: 20260331_1200
Revises: 20260320_2105
Create Date: 2026-03-31 12:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260331_1200"
down_revision: Union[str, None] = "20260320_2105"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "settlement_statuses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_type", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_month", sa.String(length=7), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="月次入金/振込ステータステーブル"
    )
    op.create_index(
        "ix_settlement_statuses_user_month",
        "settlement_statuses",
        ["user_type", "user_id", "target_month"],
        unique=True
    )
    op.create_index(op.f("ix_settlement_statuses_user_type"), "settlement_statuses", ["user_type"], unique=False)
    op.create_index(op.f("ix_settlement_statuses_user_id"), "settlement_statuses", ["user_id"], unique=False)
    op.create_index(op.f("ix_settlement_statuses_target_month"), "settlement_statuses", ["target_month"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_settlement_statuses_target_month"), table_name="settlement_statuses")
    op.drop_index(op.f("ix_settlement_statuses_user_id"), table_name="settlement_statuses")
    op.drop_index(op.f("ix_settlement_statuses_user_type"), table_name="settlement_statuses")
    op.drop_index("ix_settlement_statuses_user_month", table_name="settlement_statuses")
    op.drop_table("settlement_statuses")
