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
    """注文詳細に埋め込むための簡易受取枠情報"""
    id: int
    date: date
    slot_type: DeliverySlotType
    time_text: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    class Config:
        from_attributes = True

# ▼▼▼ 追加: これがないと 'ProductResponse is not defined' になります ▼▼▼
class ProductInfoForOrder(BaseModel):
    """注文明細に埋め込むための簡易商品情報"""
    id: int
    name: str
    unit: str
    price: Decimal
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
    consumer_id: Optional[int] = None
    delivery_slot_id: int
    delivery_address: Optional[str] = None
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

    # ▼▼▼ 修正: ProductResponse ではなく、上で作った ProductInfoForOrder を使う ▼▼▼
    product: Optional[ProductInfoForOrder] = None
    # ▲▲▲ 修正ここまで ▲▲▲


class ConsumerCompact(BaseModel):
    id: int
    name: str
    phone_number: str
    postal_code: Optional[str] = None
    address: Optional[str] = None
    building: Optional[str] = None
    class Config:
        from_attributes = True


class ConsumerOrderResponse(TimestampSchema, BaseSchema):
    """Consumer order response schema."""

    id: int
    consumer_id: int
    consumer: Optional[ConsumerCompact] = None
    
    # 簡易クラスを使用
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
                "id": 1,
                "consumer_id": 1,
                "delivery_slot_id": 10,
                "delivery_type": "HOME",
                "delivery_label": "自宅配送",
                "delivery_time_label": "14:00-16:00",
                "status": "confirmed",
                "subtotal": "1000",
                "tax_amount": "80",
                "shipping_fee": 300,
                "total_amount": "1380",
                "items": []
            }
        }


class ConsumerOrderListResponse(BaseModel):
    """Paginated response for consumer orders."""
    items: List[ConsumerOrderResponse]
    total: int
    skip: int
    limit: int