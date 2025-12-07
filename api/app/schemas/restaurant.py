"""
Restaurant Pydantic schemas.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.base import BaseSchema, TimestampSchema


class RestaurantBase(BaseModel):
    """Base restaurant fields."""
    name: str = Field(..., min_length=1, max_length=200, description="店舗名")
    phone_number: str = Field(..., min_length=10, max_length=20, description="電話番号")
    address: str = Field(..., min_length=1, max_length=500, description="住所")
    invoice_email: Optional[EmailStr] = Field(None, description="請求書送付先メールアドレス")
    business_hours: Optional[str] = Field(None, max_length=200, description="営業時間")
    notes: Optional[str] = Field(None, max_length=1000, description="備考")
    is_active: int = Field(default=1, description="アクティブフラグ")


class RestaurantCreate(RestaurantBase):
    """Schema for creating a restaurant."""
    line_user_id: str = Field(..., min_length=1, max_length=100, description="LINE User ID")


class RestaurantUpdate(BaseModel):
    """Schema for updating a restaurant (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = Field(None, min_length=1, max_length=500)
    invoice_email: Optional[EmailStr] = None
    business_hours: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[int] = None


class RestaurantResponse(RestaurantBase, TimestampSchema, BaseSchema):
    """Schema for restaurant response."""
    id: int
    line_user_id: str
    
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
