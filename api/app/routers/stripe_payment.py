"""
Stripe Payment Router - PaymentIntent管理
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models import Consumer

router = APIRouter()

# Stripe APIキー設定
stripe.api_key = settings.STRIPE_SECRET_KEY


class CreatePaymentIntentRequest(BaseModel):
    amount: int = Field(..., gt=0, description="決済金額（円）")
    save_card: bool = Field(False, description="カードを保存するか")


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    customer_id: Optional[str] = None


class PaymentConfigResponse(BaseModel):
    publishable_key: str


@router.get("/config", response_model=PaymentConfigResponse)
async def get_payment_config():
    """Stripe公開キーを返す（フロントエンドで使用）"""
    return PaymentConfigResponse(publishable_key=settings.STRIPE_PUBLISHABLE_KEY)


@router.post("/create-payment-intent", response_model=CreatePaymentIntentResponse)
async def create_payment_intent(
    request: CreatePaymentIntentRequest,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """PaymentIntentを作成し、client_secretを返す"""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured",
        )

    try:
        # Stripe Customerが未作成なら作成
        customer_id = consumer.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                metadata={"consumer_id": str(consumer.id), "line_user_id": consumer.line_user_id},
                name=consumer.name,
                phone=consumer.phone_number,
            )
            customer_id = customer.id
            consumer.stripe_customer_id = customer_id
            await db.commit()

        # PaymentIntent作成
        intent_params = {
            "amount": request.amount,
            "currency": "jpy",
            "customer": customer_id,
            "automatic_payment_methods": {"enabled": True},
            "metadata": {"consumer_id": str(consumer.id)},
        }

        if request.save_card:
            intent_params["setup_future_usage"] = "off_session"

        payment_intent = stripe.PaymentIntent.create(**intent_params)

        return CreatePaymentIntentResponse(
            client_secret=payment_intent.client_secret,
            payment_intent_id=payment_intent.id,
            customer_id=customer_id,
        )

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
