"""
Delivery Schedule Router
"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract

from app.core.database import get_db
from app.models.delivery_schedule import DeliverySchedule
from app.schemas.delivery_schedule import DeliveryScheduleCreate, DeliveryScheduleUpdate, DeliveryScheduleResponse

router = APIRouter()

@router.get("/", response_model=List[DeliveryScheduleResponse])
async def list_schedules(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    List delivery schedules.
    Can filter by month (YYYY-MM) or date range.
    """
    query = select(DeliverySchedule)
    
    if month:
        try:
            year, month_val = map(int, month.split('-'))
            query = query.where(
                and_(
                    extract('year', DeliverySchedule.date) == year,
                    extract('month', DeliverySchedule.date) == month_val
                )
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    elif start_date and end_date:
        query = query.where(
            and_(
                DeliverySchedule.date >= start_date,
                DeliverySchedule.date <= end_date
            )
        )
        
    query = query.order_by(DeliverySchedule.date)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=DeliveryScheduleResponse)
async def create_schedule(
    schedule: DeliveryScheduleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create or update a schedule for a specific date.
    If it exists, it will return the existing one (idempotent-ish check required in frontend usually, but here we can check).
    """
    # Check if exists
    query = select(DeliverySchedule).where(DeliverySchedule.date == schedule.date)
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        # If exists, update it instead of erroring, for smoother UI UX
        for key, value in schedule.model_dump().items():
            setattr(existing, key, value)
        await db.commit()
        await db.refresh(existing)
        return existing
    
    new_schedule = DeliverySchedule(**schedule.model_dump())
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    return new_schedule

@router.put("/{date_str}", response_model=DeliveryScheduleResponse)
async def update_schedule(
    date_str: date,
    schedule: DeliveryScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update schedule by date.
    """
    query = select(DeliverySchedule).where(DeliverySchedule.date == date_str)
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if not existing:
        # Create if not exists (upsert logic for convenience)
        # Assuming is_available defaults to True if not provided in update but we need to know the date
        create_data = schedule.model_dump(exclude_unset=True)
        create_data['date'] = date_str
        if 'is_available' not in create_data:
            create_data['is_available'] = True # Default
            
        new_schedule = DeliverySchedule(**create_data)
        db.add(new_schedule)
        await db.commit()
        await db.refresh(new_schedule)
        return new_schedule
        
    for key, value in schedule.model_dump(exclude_unset=True).items():
        setattr(existing, key, value)
        
    await db.commit()
    await db.refresh(existing)
    return existing
