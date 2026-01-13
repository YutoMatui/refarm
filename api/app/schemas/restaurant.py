"""
Restaurant Pydantic schemas.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.schemas.base import BaseSchema, TimestampSchema


class RestaurantBase(BaseModel):
    """Base restaurant fields."""
    name: str = Field(..., min_length=1, max_length=200, description="店舗名")
    phone_number: str = Field(..., min_length=10, max_length=20, description="電話番号")
    address: str = Field(..., min_length=1, max_length=500, description="住所")
    latitude: Optional[str] = Field(None, max_length=50, description="緯度")
    longitude: Optional[str] = Field(None, max_length=50, description="経度")
    delivery_window_start: Optional[str] = Field(None, max_length=5, description="配送希望開始時間")
    delivery_window_end: Optional[str] = Field(None, max_length=5, description="配送希望終了時間")
    invoice_email: Optional[EmailStr] = Field(None, description="請求書送付先メールアドレス")
    business_hours: Optional[str] = Field(None, max_length=200, description="営業時間")
    notes: Optional[str] = Field(None, max_length=1000, description="備考")
    is_active: int = Field(default=1, description="アクティブフラグ")
    profile_photo_url: Optional[str] = Field(None, max_length=500, description="アイコン画像URL")
    cuisine_type: Optional[str] = Field(None, max_length=100, description="業種")
    kodawari: Optional[str] = Field(None, max_length=1000, description="こだわり")
    closing_date: int = Field(default=99, description="締め日 (1-28, 99=末日)")

    @field_validator('invoice_email', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        """Convert empty string to None for optional email field."""
        if v == "":
            return None
        return v


class RestaurantCreate(RestaurantBase):
    """Schema for creating a restaurant."""
    line_user_id: Optional[str] = Field(None, max_length=100, description="LINE User ID")


class RestaurantUpdate(BaseModel):
    """Schema for updating a restaurant (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = Field(None, min_length=1, max_length=500)
    latitude: Optional[str] = Field(None, max_length=50)
    longitude: Optional[str] = Field(None, max_length=50)
    delivery_window_start: Optional[str] = Field(None, max_length=5)
    delivery_window_end: Optional[str] = Field(None, max_length=5)
    invoice_email: Optional[EmailStr] = None
    business_hours: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[int] = None
    profile_photo_url: Optional[str] = None
    cuisine_type: Optional[str] = Field(None, max_length=100)
    kodawari: Optional[str] = Field(None, max_length=1000)
    closing_date: Optional[int] = None


class RestaurantResponse(RestaurantBase, TimestampSchema, BaseSchema):
    """Schema for restaurant response."""
    id: int
    line_user_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "line_user_id": "U1234567890abcdef",
                "name": "イタリアン太郎",
                "phone_number": "078-123-4567",
                "address": "兵庫県神戸市中央区○○町1-2-3",
                "invoice_email": "billing@restaurant.com",
                "business_hours": "11:00-14:00, 18:00-22:00",
                "notes": "裏口から納品してください",
                "is_active": 1,
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


class RestaurantListResponse(BaseModel):
    """Schema for paginated restaurant list."""
    items: list[RestaurantResponse]
    total: int
    skip: int
    limit: int

# Resolve forward references
RestaurantResponse.model_rebuild()
