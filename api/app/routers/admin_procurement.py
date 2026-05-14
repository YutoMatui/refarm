"""
Admin Procurement API Router - 仕入れ集計・発注管理
"""
from datetime import datetime, date as date_type
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.routers.admin_auth import get_current_admin
from app.models.retail_product import ProcurementBatch, ProcurementItem
from app.models.consumer_order import ConsumerOrder, ConsumerOrderItem
from app.models import Order, OrderItem, Product, Farmer, DeliverySlot
from app.models.enums import ProcurementStatus, OrderStatus
from app.schemas.procurement import (
    ProcurementBatchResponse,
    ProcurementBatchListResponse,
    ProcurementItemResponse,
    ProcurementItemUpdate,
    AggregateRequest,
    UnifiedAggregateRequest,
    CalendarDateEntry,
)
from app.schemas.base import ResponseMessage
from app.services.procurement_service import aggregate_batch, aggregate_unified_batch
from app.services.line_notify import line_service

router = APIRouter()


def _format_batch_response(batch, total_orders=0):
    """ProcurementBatchからレスポンスを組み立てる"""
    items_data = []
    for item in (batch.items or []):
        sp = item.source_product
        rp = item.retail_product
        items_data.append(ProcurementItemResponse(
            id=item.id,
            batch_id=item.batch_id,
            source_product_id=item.source_product_id,
            retail_product_id=item.retail_product_id,
            total_retail_qty=item.total_retail_qty,
            b2b_direct_qty=item.b2b_direct_qty or 0,
            calculated_farmer_qty=item.calculated_farmer_qty,
            ordered_farmer_qty=item.ordered_farmer_qty,
            unit_cost=item.unit_cost,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
            source_product_name=sp.name if sp else None,
            source_product_unit=sp.unit if sp else None,
            farmer_name=sp.farmer.name if sp and sp.farmer else None,
            farmer_id=sp.farmer.id if sp and sp.farmer else None,
            retail_product_name=rp.name if rp else None,
        ))

    slot = batch.delivery_slot
    delivery_date_str = str(batch.delivery_date) if batch.delivery_date else (
        str(slot.date) if slot and slot.date else None
    )
    return ProcurementBatchResponse(
        id=batch.id,
        delivery_slot_id=batch.delivery_slot_id,
        status=batch.status,
        cutoff_at=batch.cutoff_at,
        aggregated_at=batch.aggregated_at,
        ordered_at=batch.ordered_at,
        notes=batch.notes,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        delivery_date=delivery_date_str,
        delivery_time=slot.time_text if slot else None,
        items=items_data,
        total_orders=total_orders,
    )


@router.get("/procurement", response_model=ProcurementBatchListResponse)
async def list_procurement_batches(
    status_filter: str = Query(None, alias="status", description="ステータスで絞り込み"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """仕入れバッチ一覧"""
    query = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.delivery_slot),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
            .selectinload(Product.farmer),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.retail_product),
        )
        .order_by(ProcurementBatch.id.desc())
    )
    if status_filter:
        query = query.where(ProcurementBatch.status == status_filter)

    result = await db.execute(query)
    batches = result.scalars().unique().all()

    items = [_format_batch_response(b) for b in batches]
    return ProcurementBatchListResponse(items=items, total=len(items))


@router.get("/procurement/{batch_id}", response_model=ProcurementBatchResponse)
async def get_procurement_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """仕入れバッチ詳細"""
    stmt = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.delivery_slot),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
            .selectinload(Product.farmer),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.retail_product),
        )
        .where(ProcurementBatch.id == batch_id)
    )
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="バッチが見つかりません")

    # 注文数カウント（B2B + B2C）
    total_orders = 0
    if batch.delivery_date:
        b2b_cnt = await db.scalar(
            select(func.count()).select_from(Order).where(
                func.date(Order.delivery_date) == batch.delivery_date,
                Order.status != OrderStatus.CANCELLED,
            )
        )
        total_orders += b2b_cnt or 0
    if batch.delivery_slot_id:
        b2c_cnt = await db.scalar(
            select(func.count()).select_from(ConsumerOrder).where(
                ConsumerOrder.delivery_slot_id == batch.delivery_slot_id,
                ConsumerOrder.status != OrderStatus.CANCELLED,
            )
        )
        total_orders += b2c_cnt or 0
    elif batch.delivery_date:
        # delivery_slot_id がなくても delivery_date で B2C カウント
        b2c_cnt = await db.scalar(
            select(func.count()).select_from(ConsumerOrder)
            .join(DeliverySlot, DeliverySlot.id == ConsumerOrder.delivery_slot_id)
            .where(
                DeliverySlot.date == batch.delivery_date,
                ConsumerOrder.status != OrderStatus.CANCELLED,
            )
        )
        total_orders += b2c_cnt or 0

    return _format_batch_response(batch, total_orders)


@router.post("/procurement/aggregate", response_model=ProcurementBatchResponse)
async def aggregate_procurement(
    data: AggregateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """消費者注文を集計して仕入れバッチを作成/更新（B2Cスロット指定）"""
    slot_id = data.delivery_slot_id

    # 配送スロット存在確認
    slot = await db.scalar(select(DeliverySlot).where(DeliverySlot.id == slot_id))
    if not slot:
        raise HTTPException(status_code=404, detail="配送スロットが見つかりません")

    # 既存のCOLLECTINGまたはAGGREGATEDバッチを検索
    stmt = select(ProcurementBatch).where(
        ProcurementBatch.delivery_slot_id == slot_id,
        ProcurementBatch.status.in_([ProcurementStatus.COLLECTING, ProcurementStatus.AGGREGATED]),
    )
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()

    if not batch:
        batch = ProcurementBatch(
            delivery_slot_id=slot_id,
            delivery_date=slot.date,
            status=ProcurementStatus.COLLECTING,
        )
        db.add(batch)
        await db.commit()
        await db.refresh(batch)

    # 集計実行
    batch = await aggregate_batch(batch.id, db)

    # Re-fetch with full relationships
    stmt = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.delivery_slot),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
            .selectinload(Product.farmer),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.retail_product),
        )
        .where(ProcurementBatch.id == batch.id)
    )
    result = await db.execute(stmt)
    batch = result.scalar_one()

    return _format_batch_response(batch)


@router.post("/procurement/aggregate-unified", response_model=ProcurementBatchResponse)
async def aggregate_unified_procurement(
    data: UnifiedAggregateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """B2B+B2C注文を配送日で統合集計して仕入れバッチを作成/更新"""
    try:
        target_date = datetime.strptime(data.delivery_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日付の形式はYYYY-MM-DDである必要があります")

    # 既存のCOLLECTINGまたはAGGREGATEDバッチを検索（delivery_date ベース）
    stmt = select(ProcurementBatch).where(
        ProcurementBatch.delivery_date == target_date,
        ProcurementBatch.status.in_([ProcurementStatus.COLLECTING, ProcurementStatus.AGGREGATED]),
    )
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()

    if not batch:
        batch = ProcurementBatch(
            delivery_date=target_date,
            status=ProcurementStatus.COLLECTING,
        )
        db.add(batch)
        await db.commit()
        await db.refresh(batch)

    # 統合集計実行
    batch = await aggregate_unified_batch(batch.id, db)

    # Re-fetch with full relationships
    stmt = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.delivery_slot),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
            .selectinload(Product.farmer),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.retail_product),
        )
        .where(ProcurementBatch.id == batch.id)
    )
    result = await db.execute(stmt)
    batch = result.scalar_one()

    # 注文数カウント
    b2b_cnt = await db.scalar(
        select(func.count()).select_from(Order).where(
            func.date(Order.delivery_date) == target_date,
            Order.status != OrderStatus.CANCELLED,
        )
    ) or 0
    b2c_cnt = await db.scalar(
        select(func.count()).select_from(ConsumerOrder)
        .join(DeliverySlot, DeliverySlot.id == ConsumerOrder.delivery_slot_id)
        .where(
            DeliverySlot.date == target_date,
            ConsumerOrder.status != OrderStatus.CANCELLED,
        )
    ) or 0

    return _format_batch_response(batch, b2b_cnt + b2c_cnt)


@router.get("/procurement/calendar")
async def get_procurement_calendar(
    month: str = Query(..., description="対象月 (YYYY-MM)"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """月内の注文がある日付一覧（B2B/B2C両方）+ バッチステータス"""
    try:
        year, mon = month.split("-")
        start_date = date_type(int(year), int(mon), 1)
        if int(mon) == 12:
            end_date = date_type(int(year) + 1, 1, 1)
        else:
            end_date = date_type(int(year), int(mon) + 1, 1)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="月の形式はYYYY-MMである必要があります")

    # B2B: delivery_date ごとの注文数
    b2b_query = (
        select(
            func.date(Order.delivery_date).label("d"),
            func.count(Order.id.distinct()).label("order_count"),
        )
        .where(
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) < end_date,
            Order.status != OrderStatus.CANCELLED,
        )
        .group_by(func.date(Order.delivery_date))
    )
    b2b_result = await db.execute(b2b_query)
    b2b_by_date = {str(r.d): r.order_count for r in b2b_result.all()}

    # B2C: delivery_slot.date ごとの注文数
    b2c_query = (
        select(
            DeliverySlot.date.label("d"),
            func.count(ConsumerOrder.id.distinct()).label("order_count"),
        )
        .join(DeliverySlot, DeliverySlot.id == ConsumerOrder.delivery_slot_id)
        .where(
            DeliverySlot.date >= start_date,
            DeliverySlot.date < end_date,
            ConsumerOrder.status != OrderStatus.CANCELLED,
        )
        .group_by(DeliverySlot.date)
    )
    b2c_result = await db.execute(b2c_query)
    b2c_by_date = {str(r.d): r.order_count for r in b2c_result.all()}

    # B2B: 農家数（日別）
    farmer_query = (
        select(
            func.date(Order.delivery_date).label("d"),
            func.count(Farmer.id.distinct()).label("farmer_count"),
        )
        .select_from(Order)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .join(Farmer, Product.farmer_id == Farmer.id)
        .where(
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) < end_date,
            Order.status != OrderStatus.CANCELLED,
        )
        .group_by(func.date(Order.delivery_date))
    )
    farmer_result = await db.execute(farmer_query)
    farmers_by_date = {str(r.d): r.farmer_count for r in farmer_result.all()}

    # バッチステータス（日別）
    batch_query = (
        select(ProcurementBatch.delivery_date, ProcurementBatch.status)
        .where(
            ProcurementBatch.delivery_date >= start_date,
            ProcurementBatch.delivery_date < end_date,
        )
    )
    batch_result = await db.execute(batch_query)
    batch_by_date = {str(r.delivery_date): r.status for r in batch_result.all()}

    # マージ
    all_dates = set(b2b_by_date.keys()) | set(b2c_by_date.keys())
    entries = []
    for d in sorted(all_dates):
        entries.append({
            "date": d,
            "b2b_order_count": b2b_by_date.get(d, 0),
            "b2c_order_count": b2c_by_date.get(d, 0),
            "farmer_count": farmers_by_date.get(d, 0),
            "batch_status": batch_by_date.get(d),
        })

    return entries


@router.put("/procurement/{batch_id}/items/{item_id}", response_model=ResponseMessage)
async def update_procurement_item(
    batch_id: int,
    item_id: int,
    data: ProcurementItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """仕入れ明細の発注数量を手動調整"""
    stmt = select(ProcurementItem).where(
        ProcurementItem.id == item_id,
        ProcurementItem.batch_id == batch_id,
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="明細が見つかりません")

    if data.ordered_farmer_qty is not None:
        item.ordered_farmer_qty = data.ordered_farmer_qty
    if data.notes is not None:
        item.notes = data.notes

    await db.commit()
    return ResponseMessage(message="更新しました", success=True)


@router.post("/procurement/{batch_id}/order", response_model=ResponseMessage)
async def order_from_farmers(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """農家へ一括発注（LINE通知送信）"""
    stmt = (
        select(ProcurementBatch)
        .options(
            selectinload(ProcurementBatch.delivery_slot),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.source_product)
            .selectinload(Product.farmer),
            selectinload(ProcurementBatch.items)
            .selectinload(ProcurementItem.retail_product),
        )
        .where(ProcurementBatch.id == batch_id)
    )
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="バッチが見つかりません")

    if batch.status not in (ProcurementStatus.AGGREGATED, ProcurementStatus.COLLECTING):
        raise HTTPException(status_code=400, detail=f"現在のステータス({batch.status})では発注できません")

    if not batch.items:
        raise HTTPException(status_code=400, detail="発注明細がありません。先に集計を実行してください")

    # 農家ごとにアイテムをグループ化
    farmer_items = {}
    for item in batch.items:
        sp = item.source_product
        if not sp or not sp.farmer:
            continue
        farmer = sp.farmer
        fid = farmer.id
        if fid not in farmer_items:
            farmer_items[fid] = {
                "farmer": farmer,
                "items": [],
            }
        farmer_items[fid]["items"].append(item)

    # 各農家にLINE通知
    delivery_slot = batch.delivery_slot
    for fid, data in farmer_items.items():
        farmer = data["farmer"]
        items = data["items"]
        try:
            await line_service.notify_farmer_procurement_order(
                farmer=farmer,
                items=items,
                delivery_slot=delivery_slot,
                delivery_date=batch.delivery_date,
            )
        except Exception as e:
            print(f"Failed to send procurement notification to farmer {fid}: {e}")

    now = datetime.now(ZoneInfo(settings.TZ))
    batch.status = ProcurementStatus.ORDERED
    batch.ordered_at = now
    await db.commit()

    return ResponseMessage(
        message=f"{len(farmer_items)}件の農家へ発注通知を送信しました",
        success=True,
    )
