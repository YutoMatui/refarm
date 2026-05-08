"""
Pydantic schemas for Coupon.
"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.models.coupon import DiscountType


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="クーポンコード")
    description: Optional[str] = Field(None, max_length=200)
    discount_type: DiscountType
    discount_value: Decimal = Field(..., gt=0, description="割引値")
    min_order_amount: Decimal = Field(0, ge=0, description="最低注文金額")
    max_uses: Optional[int] = Field(None, ge=1, description="最大利用回数")
    is_active: bool = True
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class CouponUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=200)
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[Decimal] = Field(None, gt=0)
    min_order_amount: Optional[Decimal] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class CouponResponse(TimestampSchema, BaseSchema):
    id: int
    code: str
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: Decimal
    min_order_amount: Decimal
    max_uses: Optional[int] = None
    used_count: int
    is_active: bool
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CouponListResponse(BaseModel):
    items: list[CouponResponse]
    total: int


class CouponValidateRequest(BaseModel):
    code: str = Field(..., description="クーポンコード")
    order_amount: Decimal = Field(..., ge=0, description="注文金額（税込）")


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    message: str
