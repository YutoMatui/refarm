"""
Farmer Pydantic schemas.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, HttpUrl, Field
from app.schemas.base import BaseSchema, TimestampSchema


class FarmerBase(BaseModel):
    """Base farmer fields."""
    name: str = Field(..., min_length=1, max_length=200, description="生産者名")
    main_crop: Optional[str] = Field(None, max_length=200, description="主要作物")
    profile_photo_url: Optional[str] = Field(None, max_length=500, description="顔写真URL")
    bio: Optional[str] = Field(None, description="プロフィール・紹介文")
    map_url: Optional[str] = Field(None, max_length=500, description="農園MAPリンク")
    email: Optional[EmailStr] = Field(None, description="メールアドレス")
    phone_number: Optional[str] = Field(None, max_length=20, description="電話番号")
    address: Optional[str] = Field(None, max_length=500, description="農園所在地")
    farming_method: Optional[str] = Field(None, max_length=200, description="栽培方法")
    certifications: Optional[str] = Field(None, max_length=500, description="認証情報")
    article_url: Optional[str] = Field(None, max_length=500, description="記事URL")
    video_url: Optional[str] = Field(None, max_length=500, description="動画URL")
    kodawari: Optional[str] = Field(None, max_length=1000, description="農家のこだわり")
    selectable_days: Optional[str] = Field(None, max_length=100, description="選択可能曜日 (JSON)")
    is_active: int = Field(default=1, description="アクティブフラグ")


class FarmerCreate(FarmerBase):
    """Schema for creating a farmer."""
    pass


class FarmerUpdate(BaseModel):
    """Schema for updating a farmer (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    main_crop: Optional[str] = Field(None, max_length=200)
    profile_photo_url: Optional[str] = Field(None, max_length=500)
    bio: Optional[str] = None
    map_url: Optional[str] = Field(None, max_length=500)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    farming_method: Optional[str] = Field(None, max_length=200)
    certifications: Optional[str] = Field(None, max_length=500)
    article_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    kodawari: Optional[str] = Field(None, max_length=1000)
    selectable_days: Optional[str] = Field(None, max_length=100)
    is_active: Optional[int] = None


class FarmerResponse(FarmerBase, TimestampSchema, BaseSchema):
    """Schema for farmer response."""
    id: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "山田太郎",
                "main_crop": "トマト、レタス",
                "profile_photo_url": "https://example.com/farmers/yamada.jpg",
                "bio": "神戸で30年以上有機栽培を続けています。",
                "map_url": "https://farm.yamada.com/map",
                "email": "yamada@farm.com",
                "phone_number": "078-999-8888",
                "address": "兵庫県神戸市西区○○町",
                "farming_method": "有機栽培",
                "certifications": "JAS有機認証",
                "article_url": "https://example.com/article/1",
                "video_url": "https://youtube.com/watch?v=123",
                "kodawari": "土づくりにこだわっています。",
                "selectable_days": "[1,3,5]",
                "is_active": 1,
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


class FarmerListResponse(BaseModel):
    """Schema for paginated farmer list."""
    items: list[FarmerResponse]
    total: int
    skip: int
    limit: int
