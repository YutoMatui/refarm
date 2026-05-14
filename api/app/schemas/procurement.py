"""
Procurement schemas - 仕入れ集計・発注
"""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema


class ProcurementItemResponse(BaseSchema, TimestampSchema):
    id: int
    batch_id: int
    source_product_id: int
    retail_product_id: Optional[int] = None
    total_retail_qty: int
    b2b_direct_qty: int = 0
    calculated_farmer_qty: Decimal
    ordered_farmer_qty: int
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None
    # Populated in router
    source_product_name: Optional[str] = None
    source_product_unit: Optional[str] = None
    farmer_name: Optional[str] = None
    farmer_id: Optional[int] = None
    retail_product_name: Optional[str] = None


class ProcurementItemUpdate(BaseModel):
    ordered_farmer_qty: Optional[int] = Field(None, ge=0, description="発注数量を手動調整")
    notes: Optional[str] = None


class ProcurementBatchResponse(BaseSchema, TimestampSchema):
    id: int
    delivery_slot_id: Optional[int] = None
    status: str
    cutoff_at: Optional[datetime] = None
    aggregated_at: Optional[datetime] = None
    ordered_at: Optional[datetime] = None
    notes: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_time: Optional[str] = None
    items: List[ProcurementItemResponse] = []
    total_orders: int = 0


class ProcurementBatchListResponse(BaseModel):
    items: List[ProcurementBatchResponse]
    total: int


class AggregateRequest(BaseModel):
    delivery_slot_id: int = Field(..., description="集計対象の配送スロットID")


class UnifiedAggregateRequest(BaseModel):
    delivery_date: str = Field(..., description="集計対象の配送日 (YYYY-MM-DD)")


class CalendarDateEntry(BaseModel):
    date: str
    b2b_order_count: int = 0
    b2c_order_count: int = 0
    farmer_count: int = 0
    batch_status: Optional[str] = None
