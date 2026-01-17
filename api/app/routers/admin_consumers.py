"""
Admin Consumer Management Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from app.core.database import get_db
from app.routers.admin_auth import get_current_admin
from app.models import Consumer, SupportMessage, Farmer
from app.schemas import PaginationParams

router = APIRouter()


@router.get("/consumers/")
async def list_consumers(
    skip: int = 0,
    limit: int = 100,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者一覧を取得（管理者用）
    """
    query = select(Consumer).order_by(desc(Consumer.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    consumers = result.scalars().all()
    
    # Count total
    count_query = select(Consumer)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())
    
    return {
        "items": consumers,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/consumers/{consumer_id}")
async def get_consumer_detail(
    consumer_id: int,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者詳細を取得（管理者用）
    """
    query = select(Consumer).where(Consumer.id == consumer_id)
    result = await db.execute(query)
    consumer = result.scalar_one_or_none()
    
    if not consumer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消費者が見つかりません"
        )
    
    return consumer


@router.get("/consumers/{consumer_id}/messages")
async def get_consumer_messages(
    consumer_id: int,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    消費者が送信した応援メッセージ一覧を取得（管理者用）
    """
    query = (
        select(SupportMessage, Farmer.name)
        .join(Farmer, SupportMessage.farmer_id == Farmer.id)
        .where(SupportMessage.consumer_id == consumer_id)
        .order_by(desc(SupportMessage.created_at))
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    messages = []
    for message, farmer_name in rows:
        messages.append({
            "id": message.id,
            "farmer_id": message.farmer_id,
            "farmer_name": farmer_name,
            "message": message.message,
            "nickname": message.nickname,
            "created_at": message.created_at
        })
    
    return messages
