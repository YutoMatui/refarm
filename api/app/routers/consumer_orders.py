"""
Consumer Orders Router - B2C注文管理
"""
import stripe
from decimal import Decimal
from datetime import time, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models import ConsumerOrder, ConsumerOrderItem, Product, DeliverySlot, Consumer, Coupon
from app.models.retail_product import RetailProduct, ProcurementBatch
from app.models.enums import OrderStatus, DeliverySlotType, ProcurementStatus

stripe.api_key = settings.STRIPE_SECRET_KEY

# 消費者がキャンセル可能なステータス
CONSUMER_CANCELLABLE_STATUSES = {OrderStatus.PENDING, OrderStatus.CONFIRMED}
from app.schemas import (
    ConsumerOrderCreate,
    ConsumerOrderResponse,
    ConsumerOrderListResponse,
)
from app.services.line_notify import line_service

router = APIRouter()


async def _safe_notify(func, order):
    """通知の例外を握りつぶしてログ出力する"""
    try:
        await func(order)
    except Exception as e:
        import traceback
        print(f"LINE notification error in {func.__name__}: {e}")
        traceback.print_exc()


SHIPPING_FEE_HOME = Decimal(500)
SHIPPING_FEE_UNIV = Decimal(0)
DELIVERY_LABEL_MAP = {
    DeliverySlotType.HOME: "自宅へ配送",
    DeliverySlotType.UNIVERSITY: "ユニバードーム付近で受取",
}
SUPPORTED_PAYMENT_METHODS = {"cash_on_delivery", "card"}


async def _ensure_slot_available(slot: DeliverySlot | None) -> DeliverySlot:
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="指定された受取枠が見つかりません")
    if not slot.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="この受取枠は予約できません")
    return slot


def _build_delivery_address(consumer: Consumer, override_address: Optional[str]) -> Optional[str]:
    if override_address:
        return override_address
    base_address = consumer.address or ""
    if consumer.building:
        value = f"{base_address} {consumer.building}".strip()
        return value or None
    return base_address or None


def _parse_times_from_label(label: str) -> tuple[time | None, time | None]:
    normalized = label.replace('〜', '-').replace('~', '-').replace(' ', '')
    parts = normalized.split('-')
    if len(parts) != 2:
        return None, None
    try:
        start_raw, end_raw = parts[0], parts[1]
        if ':' in start_raw:
            start_h, start_m = start_raw.split(':')
        else:
            start_h, start_m = start_raw, "00"
        if ':' in end_raw:
            end_h, end_m = end_raw.split(':')
        else:
            end_h, end_m = end_raw, "00"
        return time(int(start_h), int(start_m)), time(int(end_h), int(end_m))
    except Exception:
        return None, None


async def _resolve_delivery_slot(order_data: ConsumerOrderCreate, db: AsyncSession) -> DeliverySlot:
    if order_data.delivery_slot_id:
        stmt_slot = select(DeliverySlot).where(DeliverySlot.id == order_data.delivery_slot_id)
        slot_result = await db.execute(stmt_slot)
        return await _ensure_slot_available(slot_result.scalar_one_or_none())

    if not (order_data.delivery_date and order_data.delivery_type and order_data.delivery_time_label):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="受取枠IDがない場合は delivery_date / delivery_type / delivery_time_label が必要です",
        )

    stmt_existing = select(DeliverySlot).where(
        DeliverySlot.date == order_data.delivery_date,
        DeliverySlot.slot_type == order_data.delivery_type,
        DeliverySlot.time_text == order_data.delivery_time_label,
    ).order_by(DeliverySlot.id.asc())
    existing = (await db.execute(stmt_existing)).scalar_one_or_none()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            await db.flush()
        return existing

    start_time, end_time = _parse_times_from_label(order_data.delivery_time_label)
    generated_slot = DeliverySlot(
        date=order_data.delivery_date,
        slot_type=order_data.delivery_type,
        start_time=start_time,
        end_time=end_time,
        time_text=order_data.delivery_time_label,
        is_active=True,
        note="auto-generated from consumer checkout",
    )
    db.add(generated_slot)
    await db.flush()
    return generated_slot


@router.post("/", response_model=ConsumerOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_consumer_order(
    order_data: ConsumerOrderCreate,
    background_tasks: BackgroundTasks,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """Create a new consumer order."""
    if not consumer.name or not consumer.phone_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="注文にはお名前と電話番号の登録が必要です")
    if order_data.consumer_id and order_data.consumer_id != consumer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="本人の注文のみ作成できます")
    if order_data.payment_method not in SUPPORTED_PAYMENT_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未対応の支払い方法です")
    if order_data.payment_method == "card" and not order_data.stripe_payment_method_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カード決済にはStripe PaymentMethod IDが必要です")
    if order_data.save_card_for_future and not order_data.stripe_payment_method_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カード保存にはStripe PaymentMethod IDが必要です")
    if order_data.save_card_for_future and not (order_data.stripe_customer_id or consumer.stripe_customer_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="カード保存にはStripe Customer IDが必要です")

    slot = await _resolve_delivery_slot(order_data, db)

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
        payment_method=order_data.payment_method,
        stripe_payment_method_id=order_data.stripe_payment_method_id,
        stripe_payment_intent_id=order_data.stripe_payment_intent_id,
        status=OrderStatus.PENDING,
        shipping_fee=int(shipping_fee),
    )
    db.add(db_order)
    await db.flush()

    subtotal = Decimal(0)
    tax_amount = Decimal(0)
    has_retail_items = False

    for item_data in order_data.items:
        # 新フロー: retail_product_id 優先
        if item_data.retail_product_id:
            has_retail_items = True
            rp_stmt = select(RetailProduct).where(
                RetailProduct.id == item_data.retail_product_id,
                RetailProduct.deleted_at.is_(None),
            )
            rp_result = await db.execute(rp_stmt)
            rp = rp_result.scalar_one_or_none()

            if not rp:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"商品ID {item_data.retail_product_id} が見つかりません")
            if rp.is_active != 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"商品『{rp.name}』は現在購入できません")

            quantity = Decimal(item_data.quantity)
            unit_price = Decimal(rp.retail_price)
            item_tax_rate = rp.tax_rate or 8
            item_subtotal = unit_price * quantity
            item_tax = item_subtotal * (Decimal(item_tax_rate) / Decimal(100))
            item_total = item_subtotal + item_tax

            db_item = ConsumerOrderItem(
                order_id=db_order.id,
                product_id=rp.source_product_id,
                retail_product_id=rp.id,
                quantity=int(quantity),
                unit_price=unit_price,
                tax_rate=item_tax_rate,
                subtotal=item_subtotal,
                tax_amount=item_tax,
                total_amount=item_total,
                product_name=rp.name,
                product_unit=rp.retail_unit,
            )
            db.add(db_item)
            subtotal += item_subtotal
            tax_amount += item_tax

        # 旧フロー: product_id（後方互換）
        elif item_data.product_id:
            stmt_product = select(Product).where(
                Product.id == item_data.product_id,
                Product.deleted_at.is_(None),
            )
            product_result = await db.execute(stmt_product)
            product = product_result.scalar_one_or_none()

            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"商品ID {item_data.product_id} が見つかりません")
            if product.is_active != 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"商品『{product.name}』は現在購入できません")
            if product.stock_quantity is not None and item_data.quantity > product.stock_quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"商品『{product.name}』の在庫が不足しています（残り{product.stock_quantity}個）")

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
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id または retail_product_id が必要です")

    db_order.subtotal = subtotal
    db_order.tax_amount = tax_amount

    # クーポン適用
    discount_amount = Decimal(0)
    if order_data.coupon_code:
        from app.routers.coupons import validate_coupon as _validate
        coupon_result = await db.execute(select(Coupon).where(Coupon.code == order_data.coupon_code.upper()))
        coupon = coupon_result.scalar_one_or_none()
        product_total = subtotal + tax_amount
        validation = _validate(coupon, product_total)
        if not validation.valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation.message)
        discount_amount = validation.discount_amount
        db_order.coupon_code = coupon.code
        coupon.used_count += 1

    db_order.discount_amount = discount_amount
    db_order.total_amount = subtotal + tax_amount + shipping_fee - discount_amount

    if order_data.stripe_customer_id and not consumer.stripe_customer_id:
        consumer.stripe_customer_id = order_data.stripe_customer_id
    if order_data.save_card_for_future and order_data.stripe_payment_method_id:
        if order_data.stripe_customer_id:
            consumer.stripe_customer_id = order_data.stripe_customer_id
        consumer.default_stripe_payment_method_id = order_data.stripe_payment_method_id

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

    # 小売商品経由の注文の場合: 仕入れバッチに紐付け、農家通知は行わない
    if has_retail_items:
        # 対象配送スロットの COLLECTING バッチを取得または作成
        batch_stmt = select(ProcurementBatch).where(
            ProcurementBatch.delivery_slot_id == slot.id,
            ProcurementBatch.status == ProcurementStatus.COLLECTING,
        )
        batch_result = await db.execute(batch_stmt)
        batch = batch_result.scalar_one_or_none()
        if not batch:
            batch = ProcurementBatch(
                delivery_slot_id=slot.id,
                status=ProcurementStatus.COLLECTING,
            )
            db.add(batch)
            await db.commit()

    # Notify via LINE (consumer + admin のみ。農家には管理者が統合集計後に一括発注時に通知)
    background_tasks.add_task(_safe_notify, line_service.notify_consumer_order, db_order)
    background_tasks.add_task(_safe_notify, line_service.notify_admin_consumer_order, db_order)

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


@router.post("/{order_id}/cancel")
async def cancel_consumer_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="返金失敗でもキャンセルを続行する"),
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    """
    消費者が自分の注文をキャンセルする（PENDING/CONFIRMEDのみ可能）
    """
    stmt = select(ConsumerOrder).options(
        selectinload(ConsumerOrder.order_items)
        .selectinload(ConsumerOrderItem.product)
        .selectinload(Product.farmer),
        selectinload(ConsumerOrder.consumer),
        selectinload(ConsumerOrder.delivery_slot),
    ).where(ConsumerOrder.id == order_id, ConsumerOrder.consumer_id == consumer.id)

    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")

    if order.status not in CONSUMER_CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="準備中以降の注文はキャンセルできません。公式LINEよりお問い合わせください。",
        )

    # お届け2日前までキャンセル可能
    if order.delivery_slot and order.delivery_slot.date:
        from datetime import date, timedelta
        deadline = order.delivery_slot.date - timedelta(days=2)
        if date.today() > deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="お届け日の2日前を過ぎているためキャンセルできません。公式LINEよりお問い合わせください。",
            )

    # Stripe返金
    refund_id = None
    refund_failed = False
    if order.payment_method == "card" and order.stripe_payment_intent_id:
        try:
            refund = stripe.Refund.create(payment_intent=order.stripe_payment_intent_id)
            refund_id = refund.id
        except stripe.error.StripeError as e:
            if not force:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="REFUND_FAILED",
                )
            refund_failed = True

    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now()
    await db.commit()

    # リロード
    result = await db.execute(stmt)
    order = result.scalar_one()

    # LINE通知（消費者・管理者にキャンセルを通知）
    background_tasks.add_task(_safe_notify, line_service.notify_consumer_order_cancelled, order)
    background_tasks.add_task(_safe_notify, line_service.notify_admin_consumer_order_cancelled, order)

    msg = "注文をキャンセルしました"
    if refund_id:
        msg += "。返金処理を行いました。"
    elif refund_failed:
        msg += "。返金処理は失敗しましたので、別途対応が必要です。"

    return {
        "message": msg,
        "order_id": order.id,
        "status": order.status.value,
        "refund_failed": refund_failed,
    }

