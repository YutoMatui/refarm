from typing import Optional, List
from datetime import datetime, date, time
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import OrderStatus, DeliverySlotType

# ==========================================
# 1. 依存関係回避用の簡易クラス定義エリア
# ==========================================

class DeliverySlotInfoForOrder(BaseModel):
    """Simplified slot response for embedding in order details."""
    id: int
    date: date
    slot_type: DeliverySlotType
    time_text: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    class Config:
        from_attributes = True

# ▼▼▼ 追加: 商品情報の循環参照を防ぐための簡易クラス ▼▼▼
class ProductInfoForOrder(BaseModel):
    """Simplified product info for embedding."""
    id: int
    name: str
    unit: str
    price: str # または Decimal
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True
# ▲▲▲ 追加ここまで ▲▲▲


# ==========================================
# 2. メインのスキーマ定義
# ==========================================

class ConsumerOrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class ConsumerOrderCreate(BaseModel):
    delivery_slot_id: int
    delivery_notes: Optional[str] = None
    order_notes: Optional[str] = None
    items: List[ConsumerOrderItemCreate]


class ConsumerOrderItemResponse(BaseSchema, TimestampSchema):
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

    # ▼▼▼ 追加: これで ProductResponse エラーが消えます ▼▼▼
    product: Optional[ProductInfoForOrder] = None
    # ▲▲▲ 追加ここまで ▲▲▲


class ConsumerCompact(BaseModel):
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
    
    # ここは先ほどの修正通りでOK
    delivery_slot: Optional[DeliverySlotInfoForOrder] = None 
    delivery_slot_id: Optional[int]
    
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
                # ... (既存のexample) ...
            }
        }


class ConsumerOrderListResponse(BaseModel):
    """Paginated response for consumer orders."""
    items: List[ConsumerOrderResponse]
    total: int
    skip: int
    limit: int