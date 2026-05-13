"""
Retail Product schemas - 消費者向け小売商品
"""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, TimestampSchema


class RetailProductCreate(BaseModel):
    source_product_id: int = Field(..., description="仕入れ元の農家商品ID")
    name: str = Field(..., max_length=200, description="消費者向け商品名")
    description: Optional[str] = None
    retail_price: Decimal = Field(..., description="小売価格（税抜）")
    tax_rate: int = Field(8, description="税率（8 or 10）")
    retail_unit: str = Field("パック", max_length=20, description="販売単位")
    retail_quantity_label: Optional[str] = Field(None, max_length=50, description="表示ラベル（3個入り等）")
    conversion_factor: Decimal = Field(1.0, description="農家1単位あたりの小売数量")
    waste_margin_pct: int = Field(20, ge=0, le=100, description="廃棄マージン%")
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_active: int = Field(1, ge=0, le=1)
    is_featured: int = Field(0, ge=0, le=1)
    is_wakeari: int = Field(0, ge=0, le=1)
    display_order: int = Field(0)


class RetailProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    retail_price: Optional[Decimal] = None
    tax_rate: Optional[int] = None
    retail_unit: Optional[str] = None
    retail_quantity_label: Optional[str] = None
    conversion_factor: Optional[Decimal] = None
    waste_margin_pct: Optional[int] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[int] = None
    is_featured: Optional[int] = None
    is_wakeari: Optional[int] = None
    display_order: Optional[int] = None
    source_product_id: Optional[int] = None


class SourceProductInfo(BaseModel):
    """小売商品に紐づく農家商品の簡易情報"""
    id: int
    name: str
    unit: str
    cost_price: Optional[int] = None
    farmer_id: Optional[int] = None
    farmer_name: Optional[str] = None

    class Config:
        from_attributes = True


class RetailProductResponse(BaseSchema, TimestampSchema):
    id: int
    source_product_id: int
    name: str
    description: Optional[str] = None
    retail_price: Decimal
    tax_rate: int
    retail_unit: str
    retail_quantity_label: Optional[str] = None
    conversion_factor: Decimal
    waste_margin_pct: int
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_active: int
    is_featured: int
    is_wakeari: int
    display_order: int
    source_product: Optional[SourceProductInfo] = None


class RetailProductListResponse(BaseModel):
    items: List[RetailProductResponse]
    total: int
    skip: int
    limit: int


class SuggestPriceRequest(BaseModel):
    cost_price: Decimal = Field(..., description="農家の仕入値")
    conversion_factor: Decimal = Field(..., description="変換係数")
    waste_margin_pct: int = Field(20, description="廃棄マージン%")
    price_multiplier: Decimal = Field(Decimal("0.8"), description="りふぁーむマージン係数")


class SuggestPriceResponse(BaseModel):
    suggested_price: Decimal
    cost_per_retail_unit: Decimal
    breakdown: str
