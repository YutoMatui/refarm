"""
Farmer Schedule Pydantic schemas.
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field

class FarmerScheduleBase(BaseModel):
    """Base farmer schedule fields."""
    date: date
    is_available: bool = Field(default=True, description="配送可能フラグ")
    notes: Optional[str] = Field(None, max_length=200, description="備考")

class FarmerScheduleCreate(FarmerScheduleBase):
    """Schema for creating a farmer schedule."""
    pass

class FarmerScheduleUpdate(BaseModel):
    """Schema for updating a farmer schedule."""
    is_available: Optional[bool] = None
    notes: Optional[str] = None

class FarmerScheduleResponse(FarmerScheduleBase):
    """Schema for farmer schedule response."""
    id: int
    farmer_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FarmerScheduleListResponse(BaseModel):
    """Schema for list of farmer schedules."""
    items: list[FarmerScheduleResponse]
