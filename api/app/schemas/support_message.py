"""
Support Message Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SupportMessageBase(BaseModel):
    """応援メッセージ基底スキーマ"""
    farmer_id: int = Field(..., description="生産者ID")
    message: str = Field(..., min_length=1, max_length=1000, description="応援メッセージ")
    nickname: Optional[str] = Field(None, max_length=100, description="ニックネーム（任意）")


class SupportMessageCreate(SupportMessageBase):
    """応援メッセージ作成リクエスト"""
    pass


class SupportMessage(SupportMessageBase):
    """応援メッセージレスポンス"""
    id: int
    consumer_id: int
    created_at: datetime
    consumer_name: Optional[str] = Field(None, description="消費者名（匿名化可能）")

    class Config:
        from_attributes = True


class SupportMessageResponse(BaseModel):
    """応援メッセージ送信レスポンス"""
    message: str
    support_message: SupportMessage
