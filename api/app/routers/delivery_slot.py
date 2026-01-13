"""
Delivery Slots Router - B2C受取枠API
"""
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import DeliverySlot
from app.models.enums import DeliverySlotType
from app.schemas import DeliverySlotPublicResponse

router = APIRouter()


@router.get("/", response_model=list[DeliverySlotPublicResponse])
async def list_active_delivery_slots(
    slot_type: DeliverySlotType | None = Query(None, description="枠種別で絞り込み"),
    target_date: date | None = Query(None, description="特定日で絞り込み"),
    db: AsyncSession = Depends(get_db)
):
    """List active delivery slots for consumers."""
    stmt = select(DeliverySlot).where(DeliverySlot.is_active.is_(True))

    if slot_type:
        stmt = stmt.where(DeliverySlot.slot_type == slot_type)

    if target_date:
        stmt = stmt.where(DeliverySlot.date == target_date)
    else:
        today = date.today()
        stmt = stmt.where(DeliverySlot.date >= today)

    stmt = stmt.order_by(DeliverySlot.date.asc(), DeliverySlot.start_time.asc().nulls_last())
    result = await db.execute(stmt)
    slots = result.scalars().all()
    return slots
