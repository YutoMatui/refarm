"""add consumer profile image

Revision ID: 20260119_profile_img
Revises: 20260117_1842_b29988a2a962
Create Date: 2026-01-19 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260119_profile_img'
down_revision = '20260117_1842_b29988a2a962'
branch_labels = None
depends_on = None


def upgrade():
    # Add profile_image_url column to consumers table
    op.add_column('consumers', sa.Column('profile_image_url', sa.String(length=500), nullable=True, comment='プロフィール画像URL'))


def downgrade():
    # Remove profile_image_url column from consumers table
    op.drop_column('consumers', 'profile_image_url')
