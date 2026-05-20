"""add person_in_charge to delivery_slots

Revision ID: 20260520_1200
Revises: 20260519_1200
Create Date: 2026-05-20 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260520_1200'
down_revision = '20260519_1200'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column('delivery_slots', sa.Column(
            'person_in_charge', sa.String(100), nullable=True,
            comment='担当者名'
        ))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column('delivery_slots', 'person_in_charge')
    except Exception:
        pass
