"""
Consumer Orders Router - B2C注文管理
"""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models import ConsumerOrder, ConsumerOrderItem, Product, DeliverySlot, Consumer
from app.models.enums import OrderStatus, DeliverySlotType
from app.schemas import (
    ConsumerOrderCreate,
    ConsumerOrderResponse,
    ConsumerOrderListResponse,
)
from app.services.line_notify import line_service

router = APIRouter()

SHIPPING_FEE_HOME = Decimal(400)
SHIPPING_FEE_UNIV = Decimal(0)
DELIVERY_LABEL_MAP = {
    DeliverySlotType.HOME: "自宅へ配送",
    DeliverySlotType.UNIVERSITY: "兵庫県立大学 正門受取",
}


async def _ensure_slot_available(slot: DeliverySlot | None) -> DeliverySlot:
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="指定された受取枠が見つかりません")
    if not slot.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="この受取枠は予約できません")
    return slot


def _build_delivery_address(consumer: Consumer, override_address: Optional[str]) -> Optional[str]:
    if override_address:
        return override_address
    base_address = consumer.address
    if consumer.building:
        return f"{base_address} {consumer.building}"
    return base_address


@router.post("/", response_model=ConsumerOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_consumer_order(
    order_data: ConsumerOrderCreate,
    background_tasks: BackgroundTasks,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """Create a new consumer order."""
    if order_data.consumer_id != consumer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="本人の注文のみ作成できます")

    # Fetch slot
    stmt_slot = select(DeliverySlot).where(DeliverySlot.id == order_data.delivery_slot_id)
    slot_result = await db.execute(stmt_slot)
    slot = await _ensure_slot_available(slot_result.scalar_one_or_none())

    shipping_fee = SHIPPING_FEE_HOME if slot.slot_type == DeliverySlotType.HOME else SHIPPING_FEE_UNIV
    delivery_label = DELIVERY_LABEL_MAP.get(slot.slot_type, "受取")
    delivery_address = _build_delivery_address(consumer, order_data.delivery_address)
    if slot.slot_type == DeliverySlotType.HOME and not delivery_address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="配送先住所を入力してください")

    # Create order instance
    db_order = ConsumerOrder(
        consumer_id=consumer.id,
        delivery_slot_id=slot.id,
        delivery_type=slot.slot_type,
        delivery_label=delivery_label,
        delivery_time_label=slot.time_text,
        delivery_address=delivery_address,
        delivery_notes=order_data.delivery_notes,
        order_notes=order_data.order_notes,
        payment_method="cash_on_delivery",
        status=OrderStatus.PENDING,
        shipping_fee=int(shipping_fee),
    )
    db.add(db_order)
    await db.flush()

    subtotal = Decimal(0)
    tax_amount = Decimal(0)

    for item_data in order_data.items:
        stmt_product = select(Product).where(Product.id == item_data.product_id)
        product_result = await db.execute(stmt_product)
        product = product_result.scalar_one_or_none()

        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"商品ID {item_data.product_id} が見つかりません")
        if product.is_active != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"商品『{product.name}』は現在購入できません")

        quantity = Decimal(item_data.quantity)
        unit_price = Decimal(product.price)
        item_subtotal = unit_price * quantity
        item_tax = item_subtotal * (Decimal(product.tax_rate.value) / Decimal(100))
        item_total = item_subtotal + item_tax

        db_item = ConsumerOrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=int(quantity),
            unit_price=unit_price,
            tax_rate=product.tax_rate.value,
            subtotal=item_subtotal,
            tax_amount=item_tax,
            total_amount=item_total,
            product_name=product.name,
            product_unit=product.unit,
        )
        db.add(db_item)
        subtotal += item_subtotal
        tax_amount += item_tax

    db_order.subtotal = subtotal
    db_order.tax_amount = tax_amount
    db_order.total_amount = subtotal + tax_amount + shipping_fee

    await db.commit()

    # Reload order with relationships for response & notifications
    stmt_reload = select(ConsumerOrder).options(
        selectinload(ConsumerOrder.order_items)
        .selectinload(ConsumerOrderItem.product)
        .selectinload(Product.farmer),
        selectinload(ConsumerOrder.consumer),
        selectinload(ConsumerOrder.delivery_slot)
    ).where(ConsumerOrder.id == db_order.id)
    order_result = await db.execute(stmt_reload)
    db_order = order_result.scalar_one()

    # Notify via LINE (consumer + farmers)
    background_tasks.add_task(line_service.notify_consumer_order, db_order)
    background_tasks.add_task(line_service.notify_farmers_consumer_order, db_order)

    return db_order


@router.get("/", response_model=ConsumerOrderListResponse)
async def list_consumer_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """List orders for current consumer."""
    base_query = select(ConsumerOrder).options(
        selectinload(ConsumerOrder.order_items)
        .selectinload(ConsumerOrderItem.product)
        .selectinload(Product.farmer),
        selectinload(ConsumerOrder.consumer),
        selectinload(ConsumerOrder.delivery_slot)
    ).where(ConsumerOrder.consumer_id == consumer.id).order_by(ConsumerOrder.created_at.desc())

    count_stmt = select(func.count(ConsumerOrder.id)).where(ConsumerOrder.consumer_id == consumer.id)
    total = await db.scalar(count_stmt)

    result = await db.execute(base_query.offset(skip).limit(limit))
    orders = result.scalars().all()

    return ConsumerOrderListResponse(items=orders, total=total or 0, skip=skip, limit=limit)


@router.get("/{order_id}", response_model=ConsumerOrderResponse)
async def get_consumer_order_detail(
    order_id: int,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """Get order detail for current consumer."""
    stmt = select(ConsumerOrder).options(
        selectinload(ConsumerOrder.order_items)
        .selectinload(ConsumerOrderItem.product)
        .selectinload(Product.farmer),
        selectinload(ConsumerOrder.consumer),
        selectinload(ConsumerOrder.delivery_slot)
    ).where(ConsumerOrder.id == order_id, ConsumerOrder.consumer_id == consumer.id)

    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    return order


@router.patch("/{order_id}/status", response_model=ConsumerOrderResponse)
async def update_consumer_order_status(
    order_id: int,
    status_update: dict,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者が注文ステータスを更新（受け取り完了など）
    """
    # 注文を取得
    stmt = select(ConsumerOrder).options(
        selectinload(ConsumerOrder.order_items)
        .selectinload(ConsumerOrderItem.product)
        .selectinload(Product.farmer),
        selectinload(ConsumerOrder.consumer),
        selectinload(ConsumerOrder.delivery_slot)
    ).where(ConsumerOrder.id == order_id, ConsumerOrder.consumer_id == consumer.id)
    
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # ステータス更新（consumersは'received'にのみ更新可能）
    new_status = status_update.get('status')
    if new_status == 'received':
        order.status = OrderStatus.COMPLETED  # または新しいステータスを追加
        await db.commit()
        await db.refresh(order)
        return order
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="このステータスには更新できません")

