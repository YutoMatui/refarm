"""add guest interaction user image

Revision ID: 20260119_guest_img
Revises: 20260119_profile_img
Create Date: 2026-01-19 14:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260119_guest_img'
down_revision = '20260119_profile_img'
branch_labels = None
depends_on = None


def upgrade():
    # Add user_image_url column to guest_interactions table
    op.add_column('guest_interactions', sa.Column('user_image_url', sa.String(length=500), nullable=True, comment='ユーザーのプロフィール画像URL'))


def downgrade():
    # Remove user_image_url column from guest_interactions table
    op.drop_column('guest_interactions', 'user_image_url')
