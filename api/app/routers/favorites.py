"""
Favorite API Router - お気に入り管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Favorite, Product
from app.schemas import (
    FavoriteCreate,
    FavoriteResponse,
    FavoriteWithProductResponse,
    FavoriteListResponse,
    FavoriteToggleRequest,
    FavoriteToggleResponse,
    ResponseMessage,
)

router = APIRouter()


@router.post("/toggle", response_model=FavoriteToggleResponse)
async def toggle_favorite(
    restaurant_id: int,
    toggle_data: FavoriteToggleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    お気に入りのトグル（追加/削除）
    フロントエンドから使いやすいエンドポイント
    """
    # Check if favorite exists
    stmt = select(Favorite).where(
        and_(
            Favorite.restaurant_id == restaurant_id,
            Favorite.product_id == toggle_data.product_id
        )
    )
    result = await db.execute(stmt)
    favorite = result.scalar_one_or_none()
    
    if favorite:
        # Remove from favorites
        await db.delete(favorite)
        await db.commit()
        return FavoriteToggleResponse(
            is_favorited=False,
            message="お気に入りから削除しました"
        )
    else:
        # Add to favorites
        new_favorite = Favorite(
            restaurant_id=restaurant_id,
            product_id=toggle_data.product_id
        )
        db.add(new_favorite)
        await db.commit()
        return FavoriteToggleResponse(
            is_favorited=True,
            message="お気に入りに追加しました"
        )


@router.get("/restaurant/{restaurant_id}", response_model=FavoriteListResponse)
async def get_restaurant_favorites(
    restaurant_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """
    飲食店のお気に入り商品一覧を取得
    商品情報を含む
    """
    query = (
        select(Favorite)
        .options(selectinload(Favorite.product))
        .where(Favorite.restaurant_id == restaurant_id)
        .order_by(Favorite.created_at.desc())
    )
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    favorites = result.scalars().all()
    
    return FavoriteListResponse(items=favorites, total=total or 0, skip=skip, limit=limit)


@router.get("/check/{restaurant_id}/{product_id}", response_model=dict)
async def check_favorite_status(
    restaurant_id: int,
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    お気に入り状態を確認
    """
    stmt = select(Favorite).where(
        and_(
            Favorite.restaurant_id == restaurant_id,
            Favorite.product_id == product_id
        )
    )
    result = await db.execute(stmt)
    favorite = result.scalar_one_or_none()
    
    return {"is_favorited": favorite is not None}


@router.delete("/{favorite_id}", response_model=ResponseMessage)
async def delete_favorite(favorite_id: int, db: AsyncSession = Depends(get_db)):
    """お気に入りを削除"""
    stmt = select(Favorite).where(Favorite.id == favorite_id)
    result = await db.execute(stmt)
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="お気に入りが見つかりません"
        )
    
    await db.delete(favorite)
    await db.commit()
    
    return ResponseMessage(message="お気に入りを削除しました", success=True)
