"""
Admin Delivery Slots Router - 受取枠管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import DeliverySlot
from app.schemas import DeliverySlotCreate, DeliverySlotUpdate, DeliverySlotResponse, DeliverySlotListResponse
from app.routers.admin_auth import get_current_admin

router = APIRouter()


@router.get("/", response_model=DeliverySlotListResponse)
async def list_delivery_slots(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin)
):
    """List delivery slots for admin."""
    stmt = select(DeliverySlot).order_by(DeliverySlot.date.desc(), DeliverySlot.start_time.desc().nulls_last())
    count_stmt = select(func.count(DeliverySlot.id))

    total = await db.scalar(count_stmt)
    result = await db.execute(stmt.offset(skip).limit(limit))
    slots = result.scalars().all()
    return DeliverySlotListResponse(items=slots, total=total or 0, skip=skip, limit=limit)


@router.post("/", response_model=DeliverySlotResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery_slot(
    payload: DeliverySlotCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin)
):
    """Create a new delivery slot."""
    slot = DeliverySlot(**payload.model_dump())
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return slot


@router.put("/{slot_id}", response_model=DeliverySlotResponse)
async def update_delivery_slot(
    slot_id: int,
    payload: DeliverySlotUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin)
):
    """Update delivery slot."""
    stmt = select(DeliverySlot).where(DeliverySlot.id == slot_id)
    result = await db.execute(stmt)
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="受取枠が見つかりません")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(slot, field, value)

    await db.commit()
    await db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_delivery_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin)
):
    """Delete a delivery slot."""
    stmt = select(DeliverySlot).where(DeliverySlot.id == slot_id)
    result = await db.execute(stmt)
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="受取枠が見つかりません")

    await db.delete(slot)
    await db.commit()
