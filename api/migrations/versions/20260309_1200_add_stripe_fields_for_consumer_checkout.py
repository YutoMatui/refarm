"""add stripe-related fields for consumer checkout

Revision ID: 20260309_1200
Revises: b68b53c6127d
Create Date: 2026-03-09 12:00:00.000000+09:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260309_1200"
down_revision: Union[str, None] = "b68b53c6127d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column("consumers", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True, comment="Stripe Customer ID"))
    op.add_column("consumers", sa.Column("default_stripe_payment_method_id", sa.String(length=255), nullable=True, comment="デフォルトStripe PaymentMethod ID"))
    op.add_column("consumer_orders", sa.Column("stripe_payment_method_id", sa.String(length=255), nullable=True, comment="Stripe PaymentMethod ID（カード情報本体はStripeで管理）"))
    op.add_column("consumer_orders", sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True, comment="Stripe PaymentIntent ID"))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("consumer_orders", "stripe_payment_intent_id")
    op.drop_column("consumer_orders", "stripe_payment_method_id")
    op.drop_column("consumers", "default_stripe_payment_method_id")
    op.drop_column("consumers", "stripe_customer_id")
