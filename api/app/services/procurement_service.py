"""
Procurement Service - 仕入れ集計ロジック
"""
import math
from decimal import Decimal
from datetime import datetime, date as date_type
from zoneinfo import ZoneInfo
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.retail_product import RetailProduct, ProcurementBatch, ProcurementItem
from app.models.consumer_order import ConsumerOrder, ConsumerOrderItem
from app.models import Order, OrderItem, Product, Farmer, DeliverySlot
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


async def aggregate_unified_batch(batch_id: int, db: AsyncSession) -> ProcurementBatch:
    """
    配送日に紐づくB2B（飲食店）＋B2C（消費者）注文を統合集計し、
    農家への発注数量を計算する。

    アルゴリズム:
      1. 対象バッチの delivery_date に紐づくB2B注文を取得、product_idごとに数量合算
      2. 同日のB2C注文を取得、retail_product_idごとに数量合算 → conversion_factor変換
      3. source_product_id でマージして ProcurementItem を作成
      4. ordered_farmer_qty = b2b直接数量 + ceil(b2c変換数量×(1+waste/100))
    """
    # バッチ取得
    stmt = select(ProcurementBatch).where(ProcurementBatch.id == batch_id)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    target_date = batch.delivery_date
    if not target_date:
        raise ValueError("Batch has no delivery_date")

    # ===== 1. B2B飲食店注文の集計 =====
    b2b_query = (
        select(
            OrderItem.product_id.label("product_id"),
            func.sum(OrderItem.quantity).label("total_qty"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            func.date(Order.delivery_date) == target_date,
            Order.status != OrderStatus.CANCELLED,
        )
        .group_by(OrderItem.product_id)
    )
    b2b_result = await db.execute(b2b_query)
    b2b_rows = b2b_result.all()

    # product_id -> b2b数量
    b2b_by_product = {}
    for row in b2b_rows:
        b2b_by_product[row.product_id] = int(row.total_qty)

    # ===== 2. B2C消費者注文の集計 =====
    b2c_query = (
        select(
            ConsumerOrderItem.retail_product_id,
            func.sum(ConsumerOrderItem.quantity).label("total_qty"),
        )
        .join(ConsumerOrder, ConsumerOrder.id == ConsumerOrderItem.order_id)
        .join(DeliverySlot, DeliverySlot.id == ConsumerOrder.delivery_slot_id)
        .where(
            DeliverySlot.date == target_date,
            ConsumerOrder.status != OrderStatus.CANCELLED,
            ConsumerOrderItem.retail_product_id.isnot(None),
        )
        .group_by(ConsumerOrderItem.retail_product_id)
    )
    b2c_result = await db.execute(b2c_query)
    b2c_rows = b2c_result.all()

    # retail_product_id -> (total_retail_qty, source_product_id, conversion_factor, waste_margin_pct, unit_cost)
    b2c_by_source = {}  # source_product_id -> {retail_product_id, total_retail_qty, raw_farmer_qty, with_margin_qty, unit_cost}
    for row in b2c_rows:
        retail_product_id = row.retail_product_id
        total_retail_qty = int(row.total_qty)

        rp_stmt = (
            select(RetailProduct)
            .options(selectinload(RetailProduct.source_product))
            .where(RetailProduct.id == retail_product_id)
        )
        rp_result = await db.execute(rp_stmt)
        rp = rp_result.scalar_one_or_none()
        if not rp or not rp.source_product:
            continue

        source_product = rp.source_product
        sp_id = source_product.id
        conversion_factor = float(rp.conversion_factor) if rp.conversion_factor else 1.0
        waste_margin_pct = rp.waste_margin_pct or 20

        raw_farmer_qty = total_retail_qty / conversion_factor if conversion_factor > 0 else total_retail_qty
        with_margin = raw_farmer_qty * (1 + waste_margin_pct / 100)

        if sp_id in b2c_by_source:
            # 同じ source_product に複数の retail_product がマッピングされている場合は合算
            b2c_by_source[sp_id]["total_retail_qty"] += total_retail_qty
            b2c_by_source[sp_id]["raw_farmer_qty"] += raw_farmer_qty
            b2c_by_source[sp_id]["with_margin_qty"] += with_margin
        else:
            b2c_by_source[sp_id] = {
                "retail_product_id": retail_product_id,
                "total_retail_qty": total_retail_qty,
                "raw_farmer_qty": raw_farmer_qty,
                "with_margin_qty": with_margin,
                "unit_cost": Decimal(str(source_product.cost_price)) if source_product.cost_price else None,
            }

    # ===== 3. 既存の procurement_items を削除して再計算 =====
    existing_items_stmt = select(ProcurementItem).where(ProcurementItem.batch_id == batch_id)
    existing_result = await db.execute(existing_items_stmt)
    for item in existing_result.scalars().all():
        await db.delete(item)

    # ===== 4. source_product_id でマージして ProcurementItem を作成 =====
    all_product_ids = set(b2b_by_product.keys()) | set(b2c_by_source.keys())

    for product_id in all_product_ids:
        b2b_qty = b2b_by_product.get(product_id, 0)
        b2c_data = b2c_by_source.get(product_id)

        total_retail_qty = b2c_data["total_retail_qty"] if b2c_data else 0
        raw_farmer_qty = b2c_data["raw_farmer_qty"] if b2c_data else 0.0
        with_margin_qty = b2c_data["with_margin_qty"] if b2c_data else 0.0
        retail_product_id = b2c_data["retail_product_id"] if b2c_data else None

        # unit_cost: B2Cデータがあればそこから、なければproductから取得
        unit_cost = None
        if b2c_data and b2c_data["unit_cost"] is not None:
            unit_cost = b2c_data["unit_cost"]
        else:
            # B2Bのみの場合、productからcost_priceを取得
            prod_stmt = select(Product).where(Product.id == product_id)
            prod_result = await db.execute(prod_stmt)
            prod = prod_result.scalar_one_or_none()
            if prod and prod.cost_price:
                unit_cost = Decimal(str(prod.cost_price))

        # ordered_farmer_qty = B2B直接 + ceil(B2C変換+マージン)
        b2c_ordered = math.ceil(with_margin_qty) if with_margin_qty > 0 else 0
        ordered_farmer_qty = b2b_qty + b2c_ordered

        item = ProcurementItem(
            batch_id=batch_id,
            source_product_id=product_id,
            retail_product_id=retail_product_id,
            b2b_direct_qty=b2b_qty,
            total_retail_qty=total_retail_qty,
            calculated_farmer_qty=Decimal(str(round(raw_farmer_qty, 2))),
            ordered_farmer_qty=ordered_farmer_qty,
            unit_cost=unit_cost,
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
