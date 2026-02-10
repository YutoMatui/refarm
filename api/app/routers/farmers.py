"""
Farmer API Router - 生産者管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import secrets
import os
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.models import Farmer
from app.services.route_service import route_service
from app.schemas import (
    FarmerCreate,
    FarmerUpdate,
    FarmerResponse,
    FarmerListResponse,
    ResponseMessage,
)

# Admin Auth import for dependency injection
# Note: Using string import or local import inside function to avoid circular dependency if needed
# But here we will try to implement simple admin check or assume it's protected by main router configuration
# Actually, looking at main.py, /api/farmers is included without dependencies.
# So we need to protect this endpoint.
from app.routers.admin_auth import get_current_admin

router = APIRouter()


@router.post("/", response_model=FarmerResponse, status_code=status.HTTP_201_CREATED)
async def create_farmer(farmer_data: FarmerCreate, db: AsyncSession = Depends(get_db)):
    """生産者を新規登録"""
    # Auto-geocode if address is provided
    if farmer_data.address:
        coords = await route_service.get_coordinates(farmer_data.address)
        if coords:
            farmer_data.latitude = str(coords["lat"])
            farmer_data.longitude = str(coords["lng"])
            
    db_farmer = Farmer(**farmer_data.model_dump())
    db.add(db_farmer)
    await db.commit()
    await db.refresh(db_farmer)
    return db_farmer


@router.get("/", response_model=FarmerListResponse)
async def list_farmers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: int = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """生産者一覧を取得"""
    query = select(Farmer).where(Farmer.deleted_at.is_(None))
    if is_active is not None:
        query = query.where(Farmer.is_active == is_active)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    farmers = result.scalars().all()
    
    return FarmerListResponse(items=farmers, total=total or 0, skip=skip, limit=limit)


@router.get("/{farmer_id}", response_model=FarmerResponse)
async def get_farmer(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """生産者詳細を取得"""
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    return farmer


@router.put("/{farmer_id}", response_model=FarmerResponse)
async def update_farmer(
    farmer_id: int,
    farmer_data: FarmerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """生産者情報を更新"""
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    # Auto-geocode if address is changing
    if farmer_data.address is not None and farmer_data.address != farmer.address:
         coords = await route_service.get_coordinates(farmer_data.address)
         if coords:
            farmer_data.latitude = str(coords["lat"])
            farmer_data.longitude = str(coords["lng"])
            
    update_data = farmer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farmer, field, value)
    
    await db.commit()
    await db.refresh(farmer)
    return farmer


@router.delete("/{farmer_id}", response_model=ResponseMessage)
async def delete_farmer(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """生産者を削除（ソフトデリート）"""
    from datetime import datetime
    
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    farmer.deleted_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(message="生産者を削除しました", success=True)


@router.post("/{farmer_id}/unlink_line", response_model=ResponseMessage)
async def unlink_farmer_line(
    farmer_id: int, 
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    管理者によるLINE連携解除
    """
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
        
    farmer.line_user_id = None
    farmer.invite_token = None
    farmer.invite_code = None
    farmer.invite_expires_at = None
    
    await db.commit()
    return ResponseMessage(message="LINE連携を解除しました", success=True)


@router.post("/{farmer_id}/generate_invite", summary="招待URL生成")
async def generate_farmer_invite(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """
    農家向けの招待URLと認証コードを生成します。
    """
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    # 1. Generate secure token and easy code
    new_token = secrets.token_urlsafe(32)
    new_code = str(secrets.randbelow(10000)).zfill(4)
    
    # 2. Update DB
    farmer.invite_token = new_token
    farmer.invite_code = new_code
    farmer.invite_expires_at = datetime.now() + timedelta(days=7)
    
    await db.commit()
    
    # 3. Return info
    # Get LIFF ID from settings (Farmer specific)
    liff_id = settings.FARMER_LIFF_ID
    liff_base_url = f"https://liff.line.me/{liff_id}"
    
    # Add type=farmer param so frontend knows which LIFF ID to use
    return {
        "invite_url": f"{liff_base_url}?token={new_token}&type=farmer",
        "access_code": new_code,
        "expires_at": farmer.invite_expires_at
    }


@router.get("/{farmer_id}/availability", response_model=dict)
async def check_farmer_availability(
    farmer_id: int, 
    date: str = Query(..., description="日付 (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    """
    指定日の農家の出荷可否を確認
    """
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="生産者が見つかりません")

    # 1. Check specific schedule
    from app.models.farmer_schedule import FarmerSchedule
    import json
    
    stmt_sched = select(FarmerSchedule).where(
        FarmerSchedule.farmer_id == farmer_id,
        FarmerSchedule.date == target_date
    )
    result_sched = await db.execute(stmt_sched)
    schedule = result_sched.scalar_one_or_none()
    
    if schedule:
        return {
            "is_available": schedule.is_available,
            "reason": schedule.notes or ("出荷可能日設定" if schedule.is_available else "休業日設定")
        }
    
    # 2. Check weekly schedule
    is_available = False
    if farmer.selectable_days:
        try:
            allowed_days = json.loads(farmer.selectable_days)
            if isinstance(allowed_days, list):
                # 0=Sunday, 1=Monday... matches strftime('%w')
                day_idx = int(target_date.strftime('%w'))
                is_available = day_idx in allowed_days
        except:
            is_available = False
    
    return {
        "is_available": is_available,
        "reason": "曜日設定"
    }

