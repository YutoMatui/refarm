"""
Stripe Payment Router - PaymentIntent管理 & 保存済みカード
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Optional, List
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
    save_card: bool = Field(True, description="カードを保存するか")
    payment_method_id: Optional[str] = Field(None, description="保存済みカードで決済する場合のPaymentMethod ID")


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    customer_id: Optional[str] = None


class PaymentConfigResponse(BaseModel):
    publishable_key: str


class SavedCard(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int


class SavedCardsResponse(BaseModel):
    cards: List[SavedCard]


@router.get("/config", response_model=PaymentConfigResponse)
async def get_payment_config():
    """Stripe公開キーを返す（フロントエンドで使用）"""
    return PaymentConfigResponse(publishable_key=settings.STRIPE_PUBLISHABLE_KEY)


@router.get("/saved-cards", response_model=SavedCardsResponse)
async def get_saved_cards(
    consumer: Consumer = Depends(get_current_consumer),
):
    """保存済みカード一覧を取得"""
    customer_id = consumer.stripe_customer_id
    if not customer_id:
        return SavedCardsResponse(cards=[])

    try:
        payment_methods = stripe.PaymentMethod.list(
            customer=customer_id,
            type="card",
        )
        cards = [
            SavedCard(
                id=pm.id,
                brand=pm.card.brand,
                last4=pm.card.last4,
                exp_month=pm.card.exp_month,
                exp_year=pm.card.exp_year,
            )
            for pm in payment_methods.data
        ]
        return SavedCardsResponse(cards=cards)
    except stripe.error.StripeError:
        return SavedCardsResponse(cards=[])


@router.delete("/saved-cards/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_card(
    payment_method_id: str,
    consumer: Consumer = Depends(get_current_consumer),
):
    """保存済みカードを削除"""
    customer_id = consumer.stripe_customer_id
    if not customer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カードが見つかりません")

    try:
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != customer_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="このカードを削除する権限がありません")
        stripe.PaymentMethod.detach(payment_method_id)
    except stripe.error.InvalidRequestError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="カードが見つかりません")


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
        # Stripe Customerが未作成 or 無効なら作成
        customer_id = consumer.stripe_customer_id
        if customer_id:
            try:
                stripe.Customer.retrieve(customer_id)
            except stripe.error.InvalidRequestError:
                customer_id = None

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

        # 保存済みカードで決済する場合
        if request.payment_method_id:
            intent_params["payment_method"] = request.payment_method_id
            intent_params["confirm"] = True
            intent_params["return_url"] = "https://app.refarmkobe.com/local/order-complete"

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
