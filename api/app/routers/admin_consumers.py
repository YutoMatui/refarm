"""
Admin Consumer Management Router
"""
import stripe
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.routers.admin_auth import require_super_admin
from app.models import Admin, Consumer, SupportMessage, Farmer, ConsumerOrder, ConsumerOrderItem, Product, DeliverySlot
from app.models.enums import OrderStatus
from app.services.line_notify import line_service

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()


@router.get("/consumers/")
async def list_consumers(
    skip: int = 0,
    limit: int = 100,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者一覧を取得（管理者用）
    """
    query = select(Consumer).order_by(desc(Consumer.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    consumers = result.scalars().all()
    
    # Count total
    count_query = select(Consumer)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())
    
    return {
        "items": consumers,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/consumers/{consumer_id}")
async def get_consumer_detail(
    consumer_id: int,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者詳細を取得（管理者用）
    """
    query = select(Consumer).where(Consumer.id == consumer_id)
    result = await db.execute(query)
    consumer = result.scalar_one_or_none()
    
    if not consumer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消費者が見つかりません"
        )
    
    return consumer


@router.get("/consumers/{consumer_id}/messages")
async def get_consumer_messages(
    consumer_id: int,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者が送信した応援メッセージ一覧を取得（管理者用）
    """
    query = (
        select(SupportMessage, Farmer.name)
        .join(Farmer, SupportMessage.farmer_id == Farmer.id)
        .where(SupportMessage.consumer_id == consumer_id)
        .order_by(desc(SupportMessage.created_at))
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    messages = []
    for message, farmer_name in rows:
        messages.append({
            "id": message.id,
            "farmer_id": message.farmer_id,
            "farmer_name": farmer_name,
            "message": message.message,
            "nickname": message.nickname,
            "created_at": message.created_at
        })
    
    return messages


@router.get("/consumers/{consumer_id}/orders")
async def get_consumer_orders(
    consumer_id: int,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者の注文履歴を取得（管理者用）
    """
    query = (
        select(ConsumerOrder)
        .options(
            selectinload(ConsumerOrder.order_items)
            .selectinload(ConsumerOrderItem.product)
            .selectinload(Product.farmer),
            selectinload(ConsumerOrder.delivery_slot),
        )
        .where(ConsumerOrder.consumer_id == consumer_id)
        .order_by(desc(ConsumerOrder.created_at))
    )
    result = await db.execute(query)
    orders = result.scalars().all()

    def _serialize_order(order):
        return {
            "id": order.id,
            "status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "delivery_type": order.delivery_type.value if hasattr(order.delivery_type, 'value') else str(order.delivery_type),
            "delivery_label": order.delivery_label,
            "delivery_time_label": order.delivery_time_label,
            "delivery_date": order.delivery_slot.date.isoformat() if order.delivery_slot else None,
            "payment_method": order.payment_method,
            "stripe_payment_intent_id": order.stripe_payment_intent_id,
            "subtotal": str(order.subtotal),
            "tax_amount": str(order.tax_amount),
            "shipping_fee": order.shipping_fee,
            "total_amount": str(order.total_amount),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
            "items": [
                {
                    "id": item.id,
                    "product_name": item.product_name,
                    "product_unit": item.product_unit,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                    "total_amount": str(item.total_amount),
                    "farmer_name": item.product.farmer.name if item.product and item.product.farmer else None,
                }
                for item in order.order_items
            ],
        }

    return [_serialize_order(order) for order in orders]


@router.post("/consumer-orders/{order_id}/cancel")
async def cancel_consumer_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    消費者注文をキャンセルし、Stripe決済があれば返金する（管理者用）
    """
    stmt = (
        select(ConsumerOrder)
        .options(
            selectinload(ConsumerOrder.order_items)
            .selectinload(ConsumerOrderItem.product)
            .selectinload(Product.farmer),
            selectinload(ConsumerOrder.consumer),
            selectinload(ConsumerOrder.delivery_slot),
        )
        .where(ConsumerOrder.id == order_id)
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")

    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="この注文は既にキャンセル済みです")

    # Stripe返金処理
    refund_id = None
    if order.payment_method == "card" and order.stripe_payment_intent_id:
        try:
            refund = stripe.Refund.create(payment_intent=order.stripe_payment_intent_id)
            refund_id = refund.id
        except stripe.error.StripeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stripe返金に失敗しました: {str(e)}",
            )

    # ステータス更新
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now()
    await db.commit()

    # リロード
    result = await db.execute(stmt)
    order = result.scalar_one()

    # LINE通知（消費者と農家にキャンセルを通知）
    background_tasks.add_task(line_service.notify_consumer_order_cancelled, order)
    background_tasks.add_task(line_service.notify_farmers_consumer_order_cancelled, order)
    background_tasks.add_task(line_service.notify_admin_consumer_order_cancelled, order)

    return {
        "message": "注文をキャンセルしました" + ("（返金処理済み）" if refund_id else ""),
        "order_id": order.id,
        "refund_id": refund_id,
        "status": order.status.value,
    }
