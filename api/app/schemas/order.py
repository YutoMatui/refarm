"""
Order and OrderItem Pydantic schemas.
"""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import DeliveryTimeSlot, OrderStatus


# OrderItem Schemas
class OrderItemBase(BaseModel):
    """Base order item fields."""
    product_id: int = Field(..., description="商品ID")
    quantity: int = Field(..., gt=0, description="数量")


class OrderItemCreate(OrderItemBase):
    """Schema for creating an order item."""
    pass


class OrderItemResponse(BaseSchema, TimestampSchema):
    """Schema for order item response."""
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    tax_rate: int
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    product_name: str
    product_unit: str
    farmer_name: Optional[str] = None
    farmer_id: Optional[int] = None
    farmer_video_url: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "order_id": 1,
                "product_id": 1,
                "quantity": 3,
                "unit_price": "280.00",
                "tax_rate": 8,
                "subtotal": "840.00",
                "tax_amount": "67.20",
                "total_amount": "907.20",
                "product_name": "神戸産 フリルレタス",
                "product_unit": "個",
                "farmer_name": "山田農園",
                "farmer_id": 1,
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


# Order Schemas
class OrderBase(BaseModel):
    """Base order fields."""
    delivery_date: datetime = Field(..., description="配送希望日")
    delivery_time_slot: DeliveryTimeSlot = Field(..., description="配送時間枠")
    delivery_address: str = Field(..., min_length=1, max_length=500, description="配送先住所")
    delivery_phone: str = Field(..., min_length=10, max_length=20, description="配送先電話番号")
    delivery_notes: Optional[str] = Field(None, description="配送メモ")
    notes: Optional[str] = Field(None, description="注文メモ")


class OrderCreate(OrderBase):
    """Schema for creating an order."""
    restaurant_id: int = Field(..., description="飲食店ID")
    items: List[OrderItemCreate] = Field(..., min_length=1, description="注文商品リスト")


class OrderUpdate(BaseModel):
    """Schema for updating an order."""
    status: Optional[OrderStatus] = Field(None, description="注文ステータス")
    delivery_date: Optional[datetime] = None
    delivery_time_slot: Optional[DeliveryTimeSlot] = None
    delivery_notes: Optional[str] = None
    notes: Optional[str] = None


class RestaurantSummary(BaseModel):
    """Schema for restaurant summary."""
    id: int
    name: str
    
    class Config:
        from_attributes = True


class OrderResponse(OrderBase, TimestampSchema, BaseSchema):
    """Schema for order response."""
    id: int
    restaurant_id: int
    restaurant: Optional[RestaurantSummary] = None
    status: OrderStatus
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    invoice_url: Optional[str]
    confirmed_at: Optional[datetime]
    shipped_at: Optional[datetime]
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    items: List[OrderItemResponse] = Field([], validation_alias="order_items")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "restaurant_id": 1,
                "delivery_date": "2024-01-15T00:00:00+09:00",
                "delivery_time_slot": "14-16",
                "status": "confirmed",
                "subtotal": "5200.00",
                "tax_amount": "416.00",
                "total_amount": "5616.00",
                "delivery_address": "兵庫県神戸市中央区○○町1-2-3",
                "delivery_phone": "078-123-4567",
                "delivery_notes": "裏口から納品してください",
                "notes": None,
                "invoice_url": "https://example.com/invoices/123.pdf",
                "confirmed_at": "2024-01-10T10:00:00+09:00",
                "shipped_at": None,
                "delivered_at": None,
                "cancelled_at": None,
                "items": [],
                "created_at": "2024-01-10T09:30:00+09:00",
                "updated_at": "2024-01-10T10:00:00+09:00"
            }
        }


class OrderListResponse(BaseModel):
    """Schema for paginated order list."""
    items: List[OrderResponse]
    total: int
    skip: int
    limit: int


class OrderFilterParams(BaseModel):
    """Filter parameters for order list."""
    restaurant_id: Optional[int] = Field(None, description="飲食店IDで絞り込み")
    status: Optional[OrderStatus] = Field(None, description="ステータスで絞り込み")
    delivery_date_from: Optional[datetime] = Field(None, description="配送日の開始日")
    delivery_date_to: Optional[datetime] = Field(None, description="配送日の終了日")


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status."""
    status: OrderStatus = Field(..., description="新しいステータス")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "confirmed"
            }
        }
