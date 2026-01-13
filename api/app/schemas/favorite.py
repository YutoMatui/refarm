"""
Favorite Pydantic schemas.
"""
from typing import Optional, TYPE_CHECKING
from pydantic import BaseModel, Field
from app.schemas.base import BaseSchema, TimestampSchema

if TYPE_CHECKING:
    from app.schemas.product import ProductResponse


class FavoriteBase(BaseModel):
    """Base favorite fields."""
    restaurant_id: int = Field(..., description="飲食店ID")
    product_id: int = Field(..., description="商品ID")


class FavoriteCreate(FavoriteBase):
    """Schema for creating a favorite."""
    notes: Optional[str] = Field(None, description="メモ")


class FavoriteUpdate(BaseModel):
    """Schema for updating a favorite."""
    notes: Optional[str] = Field(None, description="メモ")


class FavoriteResponse(BaseSchema, TimestampSchema):
    """Schema for favorite response."""
    id: int
    restaurant_id: int
    product_id: int
    notes: Optional[int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "restaurant_id": 1,
                "product_id": 5,
                "notes": None,
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


class FavoriteWithProductResponse(FavoriteResponse):
    """Schema for favorite response with product details."""
    product: "ProductResponse"
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "restaurant_id": 1,
                "product_id": 5,
                "notes": None,
                "product": {
                    "id": 5,
                    "name": "神戸産 フリルレタス",
                    "price": "280.00",
                    "stock_type": "KOBE"
                },
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


class FavoriteListResponse(BaseModel):
    """Schema for paginated favorite list."""
    items: list[FavoriteWithProductResponse]
    total: int
    skip: int
    limit: int


class FavoriteToggleRequest(BaseModel):
    """Schema for toggling favorite status."""
    product_id: int = Field(..., description="商品ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 5
            }
        }


class FavoriteToggleResponse(BaseModel):
    """Schema for favorite toggle response."""
    is_favorited: bool = Field(..., description="お気に入り状態")
    message: str = Field(..., description="メッセージ")
    
    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "is_favorited": True,
                    "message": "お気に入りに追加しました"
                },
                {
                    "is_favorited": False,
                    "message": "お気に入りから削除しました"
                }
            ]
        }
