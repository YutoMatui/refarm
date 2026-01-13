from typing import Optional, List
from datetime import datetime, date, time
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import OrderStatus, DeliverySlotType

# from app.schemas.delivery_slot import DeliverySlotResponse # 依存関係を完全に断ち切る


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


class ConsumerOrderItemCreate(BaseModel):
    # ... existing code ...
    product_id: int
    quantity: int


class ConsumerOrderCreate(BaseModel):
    # ... existing code ...
    delivery_slot_id: int
    delivery_notes: Optional[str] = None
    order_notes: Optional[str] = None
    items: List[ConsumerOrderItemCreate]


class ConsumerOrderItemResponse(BaseSchema, TimestampSchema):
    # ... existing code ...
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


class ConsumerCompact(BaseModel):
    # ... existing code ...
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

# ConsumerOrderResponse.model_rebuild() # 不要になったので削除