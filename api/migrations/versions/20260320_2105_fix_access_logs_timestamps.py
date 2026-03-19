"""fix access_logs timestamps defaults and nullability

Revision ID: 20260320_2105
Revises: 20260320_2000
Create Date: 2026-03-20 21:05:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_2105"
down_revision: Union[str, None] = "20260320_2000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.execute(sa.text("UPDATE access_logs SET created_at = NOW() WHERE created_at IS NULL"))
    op.execute(sa.text("UPDATE access_logs SET updated_at = NOW() WHERE updated_at IS NULL"))

    op.alter_column(
        "access_logs",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    op.alter_column(
        "access_logs",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.alter_column(
        "access_logs",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )
    op.alter_column(
        "access_logs",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )
