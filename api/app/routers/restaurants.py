"""
Restaurant API Router - 飲食店管理
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import secrets
import os
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.models import Restaurant
from app.services.route_service import route_service
from app.schemas import (
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantResponse,
    RestaurantListResponse,
    PaginationParams,
    ResponseMessage,
)

router = APIRouter()


@router.post(
    "/",
    response_model=RestaurantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="飲食店を新規登録"
)
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    新しい飲食店を登録します。
    
    - **line_user_id**: LINE User ID (一意)
    - **name**: 店舗名
    - **phone_number**: 電話番号
    - **address**: 住所
    """
    # Check if LINE User ID already exists
    stmt = select(Restaurant).where(Restaurant.line_user_id == restaurant_data.line_user_id)
    result = await db.execute(stmt)
    existing_restaurant = result.scalar_one_or_none()
    
    if existing_restaurant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このLINE User IDは既に登録されています"
        )
    
    # Create new restaurant
    # Auto-geocode if address is provided
    if restaurant_data.address:
        coords = await route_service.get_coordinates(restaurant_data.address)
        if coords:
            restaurant_data.latitude = str(coords["lat"])
            restaurant_data.longitude = str(coords["lng"])
            
    db_restaurant = Restaurant(**restaurant_data.model_dump())
    db.add(db_restaurant)
    await db.commit()
    await db.refresh(db_restaurant)
    
    return db_restaurant


@router.get(
    "/",
    response_model=RestaurantListResponse,
    summary="飲食店一覧を取得"
)
async def list_restaurants(
    skip: int = Query(0, ge=0, description="スキップ数"),
    limit: int = Query(100, ge=1, le=1000, description="取得件数"),
    is_active: int = Query(None, description="アクティブフラグで絞り込み"),
    db: AsyncSession = Depends(get_db)
):
    """
    飲食店の一覧を取得します。
    """
    # Build query
    query = select(Restaurant).where(Restaurant.deleted_at.is_(None))
    
    if is_active is not None:
        query = query.where(Restaurant.is_active == is_active)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Get paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    restaurants = result.scalars().all()
    
    return RestaurantListResponse(
        items=restaurants,
        total=total or 0,
        skip=skip,
        limit=limit
    )


@router.get(
    "/{restaurant_id}",
    response_model=RestaurantResponse,
    summary="飲食店詳細を取得"
)
async def get_restaurant(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    指定された飲食店の詳細情報を取得します。
    """
    stmt = select(Restaurant).where(
        Restaurant.id == restaurant_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="飲食店が見つかりません"
        )
    
    return restaurant


@router.get(
    "/line/{line_user_id}",
    response_model=RestaurantResponse,
    summary="LINE User IDで飲食店を取得"
)
async def get_restaurant_by_line_user_id(
    line_user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    LINE User IDで飲食店を検索します（自動ログイン用）。
    """
    stmt = select(Restaurant).where(
        Restaurant.line_user_id == line_user_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="この LINE User ID で登録された飲食店が見つかりません"
        )
    
    return restaurant


@router.put(
    "/{restaurant_id}",
    response_model=RestaurantResponse,
    summary="飲食店情報を更新"
)
async def update_restaurant(
    restaurant_id: int,
    restaurant_data: RestaurantUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    飲食店の情報を更新します。
    """
    stmt = select(Restaurant).where(
        Restaurant.id == restaurant_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="飲食店が見つかりません"
        )
    
    # Update fields
    # Auto-geocode if address is changing
    if restaurant_data.address is not None and restaurant_data.address != restaurant.address:
         coords = await route_service.get_coordinates(restaurant_data.address)
         if coords:
            restaurant_data.latitude = str(coords["lat"])
            restaurant_data.longitude = str(coords["lng"])
            
    update_data = restaurant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(restaurant, field, value)
    
    await db.commit()
    await db.refresh(restaurant)
    
    return restaurant


@router.delete(
    "/{restaurant_id}",
    response_model=ResponseMessage,
    summary="飲食店を削除（ソフトデリート）"
)
async def delete_restaurant(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    飲食店を削除します（ソフトデリート）。
    """
    from datetime import datetime
    
    stmt = select(Restaurant).where(
        Restaurant.id == restaurant_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="飲食店が見つかりません"
        )
    
    # Soft delete
    restaurant.deleted_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(
        message="飲食店を削除しました",
        success=True
    )


@router.post("/{restaurant_id}/generate_invite", summary="招待URL生成")
async def generate_restaurant_invite(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    """
    飲食店向けの招待URLと認証コードを生成します。
    """
    stmt = select(Restaurant).where(Restaurant.id == restaurant_id, Restaurant.deleted_at.is_(None))
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="飲食店が見つかりません")
    
    # 1. Generate secure token and easy code
    new_token = secrets.token_urlsafe(32)
    new_code = str(secrets.randbelow(10000)).zfill(4)
    
    # 2. Update DB
    restaurant.invite_token = new_token
    restaurant.invite_code = new_code
    restaurant.invite_expires_at = datetime.now() + timedelta(days=7)
    
    await db.commit()
    
    # 3. Return info
    # Get LIFF ID from settings (Restaurant specific)
    liff_id = settings.RESTAURANT_LIFF_ID
    liff_base_url = f"https://liff.line.me/{liff_id}"
    
    # Add type=restaurant param
    return {
        "invite_url": f"{liff_base_url}?token={new_token}&type=restaurant",
        "access_code": new_code,
        "expires_at": restaurant.invite_expires_at
    }
