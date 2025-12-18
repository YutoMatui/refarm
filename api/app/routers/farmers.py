"""
Farmer API Router - 生産者管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import Farmer
from app.services.route_service import route_service
from app.schemas import (
    FarmerCreate,
    FarmerUpdate,
    FarmerResponse,
    FarmerListResponse,
    ResponseMessage,
)

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
