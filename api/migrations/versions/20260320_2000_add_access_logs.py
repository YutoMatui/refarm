"""add access logs table

Revision ID: 20260320_2000
Revises: 20260309_1200
Create Date: 2026-03-20 20:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_2000"
down_revision: Union[str, None] = "20260309_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        "access_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_type", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("actor_name", sa.String(length=255), nullable=True),
        sa.Column("line_user_id", sa.String(length=128), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=True),
        sa.Column("path", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_access_logs_actor_type"), "access_logs", ["actor_type"], unique=False)
    op.create_index(op.f("ix_access_logs_actor_id"), "access_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_access_logs_line_user_id"), "access_logs", ["line_user_id"], unique=False)
    op.create_index(op.f("ix_access_logs_created_at"), "access_logs", ["created_at"], unique=False)


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_access_logs_created_at"), table_name="access_logs")
    op.drop_index(op.f("ix_access_logs_line_user_id"), table_name="access_logs")
    op.drop_index(op.f("ix_access_logs_actor_id"), table_name="access_logs")
    op.drop_index(op.f("ix_access_logs_actor_type"), table_name="access_logs")
    op.drop_table("access_logs")
