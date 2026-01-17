"""Add missing product columns

Revision ID: add_missing_cols_002
Revises: add_producer_cols_001
Create Date: 2024-01-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_missing_cols_002'
down_revision: Union[str, None] = 'add_producer_cols_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # --- Products ---
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(sa.Column('variety', sa.String(length=200), nullable=True, comment='品種'))
        batch_op.add_column(sa.Column('farming_method', sa.String(length=50), nullable=True, server_default='conventional', comment='栽培方法'))
        batch_op.add_column(sa.Column('weight', sa.Integer(), nullable=True, comment='重量(g)'))
        batch_op.add_column(sa.Column('is_wakeari', sa.Integer(), nullable=False, server_default='0', comment='訳ありフラグ'))

    # --- Restaurants ---
    with op.batch_alter_table('restaurants') as batch_op:
        # Location
        batch_op.add_column(sa.Column('latitude', sa.String(length=50), nullable=True, comment='緯度'))
        batch_op.add_column(sa.Column('longitude', sa.String(length=50), nullable=True, comment='経度'))
        # Delivery Window
        batch_op.add_column(sa.Column('delivery_window_start', sa.String(length=5), nullable=True, comment='配送希望開始時間'))
        batch_op.add_column(sa.Column('delivery_window_end', sa.String(length=5), nullable=True, comment='配送希望終了時間'))
        # Profile
        batch_op.add_column(sa.Column('profile_photo_url', sa.String(length=500), nullable=True, comment='アイコンURL'))
        batch_op.add_column(sa.Column('cuisine_type', sa.String(length=100), nullable=True, comment='業種'))
        batch_op.add_column(sa.Column('kodawari', sa.String(length=1000), nullable=True, comment='こだわり'))
        batch_op.add_column(sa.Column('closing_date', sa.Integer(), nullable=True, server_default='99', comment='締め日'))
        # Invitation
        batch_op.add_column(sa.Column('invite_token', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('invite_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('invite_expires_at', sa.DateTime(), nullable=True))

    # --- Farmers ---
    with op.batch_alter_table('farmers') as batch_op:
        batch_op.add_column(sa.Column('line_user_id', sa.String(length=100), nullable=True, comment='LINE User ID'))
        batch_op.add_column(sa.Column('cover_photo_url', sa.String(length=500), nullable=True, comment='カバー画像URL'))
        batch_op.add_column(sa.Column('commitments', sa.JSON(), nullable=True, comment='こだわり情報'))
        batch_op.add_column(sa.Column('achievements', sa.JSON(), nullable=True, comment='実績リスト'))
        batch_op.add_column(sa.Column('chef_comments', sa.JSON(), nullable=True, comment='シェフからのコメント'))
        # Invitation
        batch_op.add_column(sa.Column('invite_token', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('invite_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('invite_expires_at', sa.DateTime(), nullable=True))

    # Create Indexes
    op.create_index(op.f('ix_restaurants_invite_token'), 'restaurants', ['invite_token'], unique=False)
    op.create_index(op.f('ix_farmers_invite_token'), 'farmers', ['invite_token'], unique=False)
    # unique index for farmer line_user_id
    op.create_index(op.f('ix_farmers_line_user_id'), 'farmers', ['line_user_id'], unique=True)


def downgrade() -> None:
    # --- Farmers ---
    op.drop_index(op.f('ix_farmers_line_user_id'), table_name='farmers')
    op.drop_index(op.f('ix_farmers_invite_token'), table_name='farmers')
    with op.batch_alter_table('farmers') as batch_op:
        batch_op.drop_column('invite_expires_at')
        batch_op.drop_column('invite_code')
        batch_op.drop_column('invite_token')
        batch_op.drop_column('chef_comments')
        batch_op.drop_column('achievements')
        batch_op.drop_column('commitments')
        batch_op.drop_column('cover_photo_url')
        batch_op.drop_column('line_user_id')

    # --- Restaurants ---
    op.drop_index(op.f('ix_restaurants_invite_token'), table_name='restaurants')
    with op.batch_alter_table('restaurants') as batch_op:
        batch_op.drop_column('invite_expires_at')
        batch_op.drop_column('invite_code')
        batch_op.drop_column('invite_token')
        batch_op.drop_column('closing_date')
        batch_op.drop_column('kodawari')
        batch_op.drop_column('cuisine_type')
        batch_op.drop_column('profile_photo_url')
        batch_op.drop_column('delivery_window_end')
        batch_op.drop_column('delivery_window_start')
        batch_op.drop_column('longitude')
        batch_op.drop_column('latitude')

    # --- Products ---
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('is_wakeari')
        batch_op.drop_column('weight')
        batch_op.drop_column('farming_method')
        batch_op.drop_column('variety')
