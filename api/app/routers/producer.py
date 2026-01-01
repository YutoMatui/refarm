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
from app.models import Farmer, Product
from app.services.route_service import route_service
from app.schemas import (
    FarmerCreate,
    FarmerUpdate,
    FarmerResponse,
    FarmerListResponse,
    ResponseMessage,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)

router = APIRouter()


@router.get("/products", response_model=ProductListResponse)
async def list_producer_products(
    farmer_id: int = Query(..., description="生産者ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """生産者の商品一覧を取得"""
    query = select(Product).where(
        Product.farmer_id == farmer_id,
        Product.deleted_at.is_(None)
    )
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_producer_product(
    product_data: ProductCreate, 
    db: AsyncSession = Depends(get_db)
):
    """商品を新規登録"""
    db_product = Product(**product_data.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_producer_product(
    product_id: int,
    product_data: ProductUpdate,
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """商品情報を更新"""
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    # Simple ownership check
    if product.farmer_id != farmer_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この商品を編集する権限がありません")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    return product



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
    # Get LIFF ID from env or use default (Farmer specific)
    liff_id = os.environ.get("FARMER_LIFF_ID", "2008689915-hECRflxu") 
    liff_base_url = f"https://liff.line.me/{liff_id}"
    
    # Add type=farmer param so frontend knows which LIFF ID to use
    return {
        "invite_url": f"{liff_base_url}?token={new_token}&type=farmer",
        "access_code": new_code,
        "expires_at": farmer.invite_expires_at
    }
