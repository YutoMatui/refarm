"""
Consumer Events API Router - 消費者行動ログ
"""
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel, Field
from typing import List, Any

from app.core.database import get_db
from app.core.dependencies import get_line_user_id
from app.models.consumer_event import ConsumerEvent
from app.models import Consumer

router = APIRouter()


class ConsumerEventCreate(BaseModel):
    event_type: str = Field(..., max_length=50)
    page: Optional[str] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    farmer_id: Optional[int] = None
    farmer_name: Optional[str] = None
    quantity: Optional[int] = None
    search_query: Optional[str] = None
    cart_item_count: Optional[int] = None
    cart_total: Optional[int] = None
    session_id: Optional[str] = None
    metadata: Optional[dict] = None


@router.post("/")
async def log_consumer_event(
    event: ConsumerEventCreate,
    request: Request,
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """消費者の行動イベントを記録"""
    # Get consumer_id from line_user_id
    consumer_id = None
    stmt = select(Consumer.id).where(Consumer.line_user_id == line_user_id)
    result = await db.scalar(stmt)
    if result:
        consumer_id = result

    db_event = ConsumerEvent(
        consumer_id=consumer_id,
        session_id=event.session_id,
        event_type=event.event_type,
        page=event.page,
        product_id=event.product_id,
        product_name=event.product_name,
        farmer_id=event.farmer_id,
        farmer_name=event.farmer_name,
        quantity=event.quantity,
        search_query=event.search_query,
        cart_item_count=event.cart_item_count,
        cart_total=event.cart_total,
        metadata_=event.metadata,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:512],
    )
    db.add(db_event)
    await db.commit()

    return {"ok": True}
