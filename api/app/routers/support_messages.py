"""
Support Message Router
消費者から生産者への応援メッセージAPI
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_consumer_id
from app.models.support_message import SupportMessage
from app.models.consumer import Consumer
from app.models.farmer import Farmer
from app.schemas.support_message import (
    SupportMessageCreate,
    SupportMessage as SupportMessageSchema,
    SupportMessageResponse
)

router = APIRouter(prefix="/support-messages", tags=["support-messages"])


@router.post("/", response_model=SupportMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_support_message(
    message_data: SupportMessageCreate,
    consumer_id: int = Depends(get_current_consumer_id),
    db: AsyncSession = Depends(get_db)
):
    """
    応援メッセージを送信
    
    - 消費者が生産者に応援メッセージを送信
    - ニックネームは任意（省略可能）
    """
    # 生産者の存在確認
    farmer_query = select(Farmer).where(Farmer.id == message_data.farmer_id, Farmer.deleted_at.is_(None))
    farmer_result = await db.execute(farmer_query)
    farmer = farmer_result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された生産者が見つかりません"
        )
    
    # 応援メッセージを作成
    new_message = SupportMessage(
        consumer_id=consumer_id,
        farmer_id=message_data.farmer_id,
        message=message_data.message,
        nickname=message_data.nickname
    )
    
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    
    # 消費者名を取得（ニックネームがある場合はそちらを優先）
    consumer_query = select(Consumer).where(Consumer.id == consumer_id)
    consumer_result = await db.execute(consumer_query)
    consumer = consumer_result.scalar_one_or_none()
    
    # レスポンス用にconsumer_nameを追加
    message_dict = {
        **new_message.__dict__,
        "consumer_name": new_message.nickname if new_message.nickname else (consumer.name if consumer else "匿名")
    }
    
    return {
        "message": "応援メッセージを送信しました",
        "support_message": message_dict
    }


@router.get("/farmer/{farmer_id}", response_model=List[SupportMessageSchema])
async def get_farmer_support_messages(
    farmer_id: int,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    特定の生産者への応援メッセージ一覧を取得
    
    - 新しい順に表示
    - 消費者名はニックネームがあればそちらを表示
    """
    query = (
        select(SupportMessage, Consumer.name)
        .join(Consumer, SupportMessage.consumer_id == Consumer.id)
        .where(SupportMessage.farmer_id == farmer_id)
        .order_by(desc(SupportMessage.created_at))
        .limit(limit)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    messages = []
    for message, consumer_name in rows:
        message_dict = {
            **message.__dict__,
            "consumer_name": message.nickname if message.nickname else consumer_name
        }
        messages.append(message_dict)
    
    return messages


@router.get("/consumer/me", response_model=List[SupportMessageSchema])
async def get_my_support_messages(
    consumer_id: int = Depends(get_current_consumer_id),
    db: AsyncSession = Depends(get_db)
):
    """
    自分が送信した応援メッセージ一覧を取得
    """
    query = (
        select(SupportMessage, Consumer.name)
        .join(Consumer, SupportMessage.consumer_id == Consumer.id)
        .where(SupportMessage.consumer_id == consumer_id)
        .order_by(desc(SupportMessage.created_at))
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    messages = []
    for message, consumer_name in rows:
        message_dict = {
            **message.__dict__,
            "consumer_name": message.nickname if message.nickname else consumer_name
        }
        messages.append(message_dict)
    
    return messages
