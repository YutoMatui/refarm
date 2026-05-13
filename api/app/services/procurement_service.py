"""
Procurement Service - 仕入れ集計ロジック
"""
import math
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.retail_product import RetailProduct, ProcurementBatch, ProcurementItem
from app.models.consumer_order import ConsumerOrder, ConsumerOrderItem
from app.models.product import Product
from app.models.enums import OrderStatus, ProcurementStatus


async def aggregate_batch(batch_id: int, db: AsyncSession) -> ProcurementBatch:
    """
    配送スロットに紐づく消費者注文を集計し、農家への発注数量を計算する。

    アルゴリズム:
      1. 対象バッチの delivery_slot_id に紐づく消費者注文を取得
      2. retail_product_id ごとに数量を合計
      3. conversion_factor で農家単位に変換
      4. waste_margin_pct を上乗せし、切り上げ
    """
    # バッチ取得
    stmt = select(ProcurementBatch).where(ProcurementBatch.id == batch_id)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    slot_id = batch.delivery_slot_id
    if not slot_id:
        raise ValueError("Batch has no delivery_slot_id")

    # 対象スロットの消費者注文アイテムを集計（キャンセル除外）
    agg_query = (
        select(
            ConsumerOrderItem.retail_product_id,
            func.sum(ConsumerOrderItem.quantity).label("total_qty"),
        )
        .join(ConsumerOrder, ConsumerOrder.id == ConsumerOrderItem.order_id)
        .where(
            ConsumerOrder.delivery_slot_id == slot_id,
            ConsumerOrder.status != OrderStatus.CANCELLED,
            ConsumerOrderItem.retail_product_id.isnot(None),
        )
        .group_by(ConsumerOrderItem.retail_product_id)
    )
    result = await db.execute(agg_query)
    aggregated = result.all()

    # 既存の procurement_items を削除して再計算
    existing_items_stmt = select(ProcurementItem).where(ProcurementItem.batch_id == batch_id)
    existing_result = await db.execute(existing_items_stmt)
    for item in existing_result.scalars().all():
        await db.delete(item)

    # 各小売商品ごとに農家発注数量を計算
    for row in aggregated:
        retail_product_id = row.retail_product_id
        total_retail_qty = int(row.total_qty)

        # 小売商品情報を取得
        rp_stmt = (
            select(RetailProduct)
            .options(selectinload(RetailProduct.source_product))
            .where(RetailProduct.id == retail_product_id)
        )
        rp_result = await db.execute(rp_stmt)
        rp = rp_result.scalar_one_or_none()
        if not rp:
            continue

        source_product = rp.source_product
        if not source_product:
            continue

        conversion_factor = float(rp.conversion_factor) if rp.conversion_factor else 1.0
        waste_margin_pct = rp.waste_margin_pct or 20

        # 計算
        raw_farmer_qty = total_retail_qty / conversion_factor if conversion_factor > 0 else total_retail_qty
        with_margin = raw_farmer_qty * (1 + waste_margin_pct / 100)
        ordered_farmer_qty = math.ceil(with_margin)

        item = ProcurementItem(
            batch_id=batch_id,
            source_product_id=source_product.id,
            retail_product_id=retail_product_id,
            total_retail_qty=total_retail_qty,
            calculated_farmer_qty=Decimal(str(round(raw_farmer_qty, 2))),
            ordered_farmer_qty=ordered_farmer_qty,
            unit_cost=Decimal(str(source_product.cost_price)) if source_product.cost_price else None,
        )
        db.add(item)

    now = datetime.now(ZoneInfo(settings.TZ))
    batch.status = ProcurementStatus.AGGREGATED
    batch.aggregated_at = now

    await db.commit()

    # Re-fetch with items
    stmt = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
        )
        .where(ProcurementBatch.id == batch_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()
