"""
Pydantic schemas for consumer orders.
"""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.schemas.delivery_slot import DeliverySlotPublicResponse
from app.models.enums import OrderStatus, DeliverySlotType


class ConsumerOrderItemCreate(BaseModel):
    """Schema for creating consumer order items."""

    product_id: int = Field(..., description="商品ID")
    quantity: int = Field(..., gt=0, description="数量")


class ConsumerOrderCreate(BaseModel):
    """Schema for creating a consumer order."""

    consumer_id: int = Field(..., description="消費者ID")
    delivery_slot_id: int = Field(..., description="受取枠ID")
    delivery_address: Optional[str] = Field(None, description="配送先住所 (自宅配送時)", max_length=500)
    delivery_notes: Optional[str] = Field(None, description="受取に関するメモ")
    order_notes: Optional[str] = Field(None, description="注文メモ")
    items: List[ConsumerOrderItemCreate] = Field(..., min_length=1, description="注文商品リスト")


class ConsumerOrderItemResponse(BaseSchema, TimestampSchema):
    """Consumer order item response."""

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

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "order_id": 10,
                "product_id": 5,
                "quantity": 2,
                "unit_price": "250.00",
                "tax_rate": 8,
                "subtotal": "500.00",
                "tax_amount": "40.00",
                "total_amount": "540.00",
                "product_name": "キャベツ",
                "product_unit": "玉",
                "created_at": "2026-01-13T10:00:00+09:00",
                "updated_at": "2026-01-13T10:00:00+09:00"
            }
        }


class ConsumerCompact(BaseModel):
    """Compact consumer info for embedding."""

    id: int
    name: str
    phone_number: str
    postal_code: str
    address: str
    building: Optional[str] = None

    class Config:
        from_attributes = True


class ConsumerOrderResponse(TimestampSchema, BaseSchema):
    """Consumer order response schema."""

    id: int
    consumer_id: int
    consumer: Optional[ConsumerCompact] = None
    delivery_slot_id: Optional[int]
    delivery_slot: Optional[DeliverySlotPublicResponse] = None
    delivery_type: DeliverySlotType
    delivery_label: str
    delivery_time_label: str
    delivery_address: Optional[str]
    delivery_notes: Optional[str]
    order_notes: Optional[str]
    payment_method: str
    status: OrderStatus
    subtotal: Decimal
    tax_amount: Decimal
    shipping_fee: int
    total_amount: Decimal
    confirmed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    items: List[ConsumerOrderItemResponse] = Field([], validation_alias="order_items")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 10,
                "consumer_id": 1,
                "delivery_slot_id": 3,
                "delivery_type": "HOME",
                "delivery_label": "自宅へ配送",
                "delivery_time_label": "1月20日 14:00〜16:00",
                "delivery_address": "兵庫県神戸市中央区加納町6-5-1",
                "delivery_notes": "インターホンを鳴らしてください",
                "payment_method": "cash_on_delivery",
                "status": "pending",
                "subtotal": "500.00",
                "tax_amount": "40.00",
                "shipping_fee": 400,
                "total_amount": "940.00",
                "created_at": "2026-01-13T10:00:00+09:00",
                "updated_at": "2026-01-13T10:00:00+09:00"
            }
        }


class ConsumerOrderListResponse(BaseModel):
    """Paginated response for consumer orders."""

    items: List[ConsumerOrderResponse]
    total: int
    skip: int
    limit: int
