"""
Admin Consumer Analytics Router - 消費者行動分析
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.routers.admin_auth import get_current_admin
from app.models.consumer_event import ConsumerEvent
from app.models import Consumer

router = APIRouter()


@router.get("/summary")
async def get_analytics_summary(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    """指定期間の消費者行動サマリー"""
    since = datetime.now() - timedelta(days=days)

    # Total events
    total = await db.scalar(
        select(func.count(ConsumerEvent.id)).where(ConsumerEvent.created_at >= since)
    )

    # Unique consumers
    unique_consumers = await db.scalar(
        select(func.count(func.distinct(ConsumerEvent.consumer_id))).where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.consumer_id.isnot(None)
        )
    )

    # Event breakdown
    stmt = (
        select(ConsumerEvent.event_type, func.count(ConsumerEvent.id).label("count"))
        .where(ConsumerEvent.created_at >= since)
        .group_by(ConsumerEvent.event_type)
        .order_by(desc("count"))
    )
    result = await db.execute(stmt)
    event_breakdown = [{"event_type": r.event_type, "count": r.count} for r in result.all()]

    # Top viewed products
    stmt = (
        select(
            ConsumerEvent.product_id,
            ConsumerEvent.product_name,
            func.count(ConsumerEvent.id).label("view_count")
        )
        .where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "product_view",
            ConsumerEvent.product_id.isnot(None)
        )
        .group_by(ConsumerEvent.product_id, ConsumerEvent.product_name)
        .order_by(desc("view_count"))
        .limit(20)
    )
    result = await db.execute(stmt)
    top_products = [{"product_id": r.product_id, "product_name": r.product_name, "view_count": r.view_count} for r in result.all()]

    # Top searches
    stmt = (
        select(ConsumerEvent.search_query, func.count(ConsumerEvent.id).label("count"))
        .where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "search",
            ConsumerEvent.search_query.isnot(None)
        )
        .group_by(ConsumerEvent.search_query)
        .order_by(desc("count"))
        .limit(20)
    )
    result = await db.execute(stmt)
    top_searches = [{"query": r.search_query, "count": r.count} for r in result.all()]

    # Cart additions vs orders (conversion)
    cart_adds = await db.scalar(
        select(func.count(ConsumerEvent.id)).where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "add_to_cart"
        )
    )
    orders = await db.scalar(
        select(func.count(ConsumerEvent.id)).where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "order_complete"
        )
    )

    return {
        "period_days": days,
        "total_events": total or 0,
        "unique_consumers": unique_consumers or 0,
        "event_breakdown": event_breakdown,
        "top_viewed_products": top_products,
        "top_searches": top_searches,
        "cart_adds": cart_adds or 0,
        "order_completes": orders or 0,
        "conversion_rate": round((orders or 0) / max(cart_adds or 1, 1) * 100, 1),
    }


@router.get("/events")
async def list_consumer_events(
    event_type: Optional[str] = Query(None),
    consumer_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    """消費者イベント一覧"""
    query = select(ConsumerEvent).order_by(ConsumerEvent.created_at.desc())

    if event_type:
        query = query.where(ConsumerEvent.event_type == event_type)
    if consumer_id:
        query = query.where(ConsumerEvent.consumer_id == consumer_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset(skip).limit(limit))
    events = result.scalars().all()

    return {
        "items": [
            {
                "id": e.id,
                "consumer_id": e.consumer_id,
                "session_id": e.session_id,
                "event_type": e.event_type,
                "page": e.page,
                "product_id": e.product_id,
                "product_name": e.product_name,
                "farmer_id": e.farmer_id,
                "farmer_name": e.farmer_name,
                "quantity": e.quantity,
                "search_query": e.search_query,
                "cart_item_count": e.cart_item_count,
                "cart_total": e.cart_total,
                "metadata": e.metadata_,
                "created_at": e.created_at,
            }
            for e in events
        ],
        "total": total or 0,
        "skip": skip,
        "limit": limit,
    }


@router.get("/cart-abandoners")
async def get_cart_abandoners(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    """カート離脱者一覧（カートに追加したが注文していない消費者）"""
    since = datetime.now() - timedelta(days=days)

    # Consumers who added to cart
    cart_adders = (
        select(func.distinct(ConsumerEvent.consumer_id))
        .where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "add_to_cart",
            ConsumerEvent.consumer_id.isnot(None),
        )
    )

    # Consumers who completed order
    orderers = (
        select(func.distinct(ConsumerEvent.consumer_id))
        .where(
            ConsumerEvent.created_at >= since,
            ConsumerEvent.event_type == "order_complete",
            ConsumerEvent.consumer_id.isnot(None),
        )
    )

    # Cart adders who did NOT order
    stmt = (
        select(Consumer.id, Consumer.name, Consumer.line_user_id)
        .where(
            Consumer.id.in_(cart_adders),
            Consumer.id.notin_(orderers),
        )
    )
    result = await db.execute(stmt)
    abandoners = [
        {"consumer_id": r.id, "name": r.name, "line_user_id": r.line_user_id}
        for r in result.all()
    ]

    return {"period_days": days, "count": len(abandoners), "abandoners": abandoners}
