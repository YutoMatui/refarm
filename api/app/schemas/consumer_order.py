from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import OrderStatus, DeliverySlotType

# 循環参照回避のため、TYPE_CHECKING ブロック内でインポートするか、
# 同一ファイル内に DeliverySlotResponse があると仮定します。
# 別ファイルにある場合は: from app.schemas.delivery import DeliverySlotResponse
if TYPE_CHECKING:
    from app.schemas.delivery import DeliverySlotResponse 

# ... (ConsumerOrderItemCreate, ConsumerOrderCreate はそのまま) ...

class ConsumerOrderItemResponse(BaseSchema, TimestampSchema):
    # ... (変更なし) ...
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
    # ... (変更なし) ...
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
    
    # ▼▼▼ 修正: フロントエンドのエラーを解消するためここに追加 ▼▼▼
    # 文字列 "DeliverySlotResponse" にすることで RecursionError を回避します
    delivery_slot: Optional["DeliverySlotResponse"] = None 
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

ConsumerOrderResponse.model_rebuild()