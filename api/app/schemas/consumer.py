"""
Pydantic schemas for B2C consumer users.
"""
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema


class ConsumerBase(BaseModel):
    """Base fields required for consumer registration."""

    name: str = Field(..., description="氏名", min_length=1, max_length=200)
    phone_number: str = Field(..., description="電話番号", min_length=10, max_length=20)
    postal_code: Optional[str] = Field(None, description="郵便番号", min_length=3, max_length=10)
    address: Optional[str] = Field(None, description="住所 (都道府県・市区町村・番地)", min_length=1, max_length=500)
    building: Optional[str] = Field(None, description="建物名・部屋番号")
    profile_image_url: Optional[str] = Field(None, description="プロフィール画像URL")
    organization_id: Optional[int] = Field(None, description="所属組織ID")


class ConsumerAuthRequest(BaseModel):
    """Consumer auth verification request."""

    id_token: str = Field(..., description="LINEログインで取得したIDトークン")


class ConsumerRegisterRequest(ConsumerBase):
    """Consumer registration request schema."""

    id_token: str = Field(..., description="LINEログインで取得したIDトークン")


class ConsumerUpdateRequest(BaseModel):
    """Consumer profile update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    postal_code: Optional[str] = Field(None, min_length=3, max_length=10)
    address: Optional[str] = Field(None, min_length=1, max_length=500)
    building: Optional[str] = Field(None, description="建物名・部屋番号")
    profile_image_url: Optional[str] = Field(None, description="プロフィール画像URL")
    organization_id: Optional[int] = Field(None, description="所属組織ID")


class ConsumerResponse(ConsumerBase, TimestampSchema, BaseSchema):
    """Consumer response model."""

    id: int
    line_user_id: str
    organization_id: Optional[int]

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "line_user_id": "U1234567890abcdef",
                "name": "山田 太郎",
                "phone_number": "08012345678",
                "postal_code": "6500001",
                "address": "兵庫県神戸市中央区加納町6-5-1",
                "building": "神戸タワー 501号室",
                "created_at": "2026-01-13T10:00:00+09:00",
                "updated_at": "2026-01-13T10:00:00+09:00"
            }
        }


class ConsumerAuthResponse(BaseModel):
    """Response schema for consumer auth verification."""

    line_user_id: str = Field(..., description="LINE User ID")
    consumer: Optional[ConsumerResponse] = Field(None, description="登録済みの場合の会員情報")
    is_registered: bool = Field(..., description="登録済みフラグ")
    message: str = Field(..., description="メッセージ")


class ConsumerExistsResponse(BaseModel):
    """Response schema to indicate consumer existence."""

    is_registered: bool
