from typing import Optional
from datetime import date
from pydantic import BaseModel, Field
from app.schemas.base import BaseSchema, TimestampSchema

class DeliveryScheduleBase(BaseSchema):
    date: date
    is_available: bool = True
    procurement_staff: Optional[str] = None
    delivery_staff: Optional[str] = None
    time_slot: Optional[str] = Field(None, description="配送可能時間")

class DeliveryScheduleCreate(DeliveryScheduleBase):
    pass

class DeliveryScheduleUpdate(BaseModel):
    is_available: Optional[bool] = None
    procurement_staff: Optional[str] = None
    delivery_staff: Optional[str] = None
    time_slot: Optional[str] = None

class DeliveryScheduleResponse(DeliveryScheduleBase, TimestampSchema):
    id: int
