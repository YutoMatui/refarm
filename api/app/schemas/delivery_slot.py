"""
Pydantic schemas for B2C delivery slots.
"""
from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import DeliverySlotType


class DeliverySlotBase(BaseModel):
    """Base fields for delivery slots."""

    date: date = Field(..., description="対象日")
    slot_type: DeliverySlotType = Field(..., description="枠種別")
    start_time: Optional[time] = Field(None, description="開始時刻")
    end_time: Optional[time] = Field(None, description="終了時刻")
    time_text: str = Field(..., description="表示用テキスト", max_length=120)
    note: Optional[str] = Field(None, description="備考")
    is_active: bool = Field(True, description="公開フラグ")


class DeliverySlotCreate(DeliverySlotBase):
    """Schema for creating delivery slot."""
    pass


class DeliverySlotUpdate(BaseModel):
    """Partial update schema for delivery slot."""

    date: Optional[date] = None
    slot_type: Optional[DeliverySlotType] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    time_text: Optional[str] = Field(None, max_length=120)
    note: Optional[str] = None
    is_active: Optional[bool] = None


class DeliverySlotResponse(DeliverySlotBase, TimestampSchema, BaseSchema):
    """Delivery slot response."""

    id: int

    class Config:
        json_schema_extra = {
            "example": {
                "id": 10,
                "date": "2026-01-20",
                "slot_type": "HOME",
                "start_time": "14:00:00",
                "end_time": "16:00:00",
                "time_text": "1月20日 14:00〜16:00",
                "is_active": True,
                "created_at": "2026-01-13T10:00:00+09:00",
                "updated_at": "2026-01-13T10:00:00+09:00"
            }
        }


class DeliverySlotPublicResponse(BaseModel):
    """Simplified slot response for consumer UI."""

    id: int
    date: date
    slot_type: DeliverySlotType
    time_text: str
    is_active: bool

    class Config:
        from_attributes = True


class DeliverySlotListResponse(BaseModel):
    """List response wrapper."""

    items: list[DeliverySlotResponse]
    total: int
