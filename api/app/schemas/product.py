"""
Product Pydantic schemas.
"""
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, computed_field
from app.schemas.base import BaseSchema, TimestampSchema
from app.models.enums import StockType, TaxRate, ProductCategory, HarvestStatus, FarmingMethod


class ProductBase(BaseModel):
    """Base product fields."""
    name: str = Field(..., min_length=1, max_length=200, description="商品名")
    variety: Optional[str] = Field(None, max_length=200, description="品種")
    farming_method: Optional[FarmingMethod] = Field(None, description="栽培方法")
    weight: Optional[int] = Field(None, description="重量(g)")
    description: Optional[str] = Field(None, description="商品説明")
    price: Decimal = Field(..., gt=0, description="単価(税抜)")
    cost_price: Optional[int] = Field(None, description="仕入れ値")
    harvest_status: Optional[HarvestStatus] = Field(None, description="収穫状況")
    tax_rate: TaxRate = Field(..., description="税率")
    unit: str = Field(default="個", max_length=20, description="単位")
    stock_type: StockType = Field(..., description="種別(KOBE/OTHER)")
    category: Optional[ProductCategory] = Field(None, description="カテゴリ")
    stock_quantity: Optional[int] = Field(None, ge=0, description="在庫数")
    image_url: Optional[str] = Field(None, max_length=500, description="商品画像URL")
    media_url: Optional[str] = Field(None, max_length=500, description="動画・POP素材URL")
    is_active: int = Field(default=1, description="販売可否")
    is_featured: int = Field(default=0, description="おすすめフラグ")
    is_wakeari: int = Field(default=0, description="訳ありフラグ")
    display_order: int = Field(default=0, description="表示順序")


class ProductCreate(ProductBase):
    """Schema for creating a product."""
    farmer_id: Optional[int] = Field(None, description="生産者ID")


class ProductUpdate(BaseModel):
    """Schema for updating a product (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    variety: Optional[str] = None
    farming_method: Optional[FarmingMethod] = None
    weight: Optional[int] = None
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, gt=0)
    tax_rate: Optional[TaxRate] = None
    unit: Optional[str] = Field(None, max_length=20)
    stock_type: Optional[StockType] = None
    category: Optional[ProductCategory] = None
    stock_quantity: Optional[int] = Field(None, ge=0)
    image_url: Optional[str] = Field(None, max_length=500)
    media_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[int] = None
    is_featured: Optional[int] = None
    display_order: Optional[int] = None
    farmer_id: Optional[int] = None


class ProductResponse(ProductBase, TimestampSchema, BaseSchema):
    """Schema for product response."""
    id: int
    farmer_id: Optional[int]
    
    @computed_field
    @property
    def price_with_tax(self) -> Decimal:
        """税込価格を計算"""
        return self.price * (1 + Decimal(self.tax_rate.value) / 100)
    
    @computed_field
    @property
    def is_kobe_veggie(self) -> bool:
        """神戸野菜かどうか"""
        return self.stock_type == StockType.KOBE
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "farmer_id": 1,
                "name": "神戸産 フリルレタス",
                "variety": "ハンサムグリーン",
                "farming_method": "organic",
                "weight": 150,
                "description": "新鮮な朝採りフリルレタス",
                "price": "280.00",
                "tax_rate": "REDUCED",
                "unit": "個",
                "stock_type": "KOBE",
                "category": "LEAFY",
                "stock_quantity": 50,
                "image_url": "https://example.com/products/lettuce.jpg",
                "media_url": "https://example.com/media/lettuce_story.mp4",
                "is_active": 1,
                "is_featured": 1,
                "display_order": 1,
                "price_with_tax": "302.40",
                "is_kobe_veggie": True,
                "created_at": "2024-01-01T00:00:00+09:00",
                "updated_at": "2024-01-01T00:00:00+09:00"
            }
        }


class ProductListResponse(BaseModel):
    """Schema for paginated product list."""
    items: list[ProductResponse]
    total: int
    skip: int
    limit: int


class ProductFilterParams(BaseModel):
    """Filter parameters for product list."""
    stock_type: Optional[StockType] = Field(None, description="種別で絞り込み")
    category: Optional[ProductCategory] = Field(None, description="カテゴリで絞り込み")
    farmer_id: Optional[int] = Field(None, description="生産者IDで絞り込み")
    is_active: Optional[int] = Field(None, description="販売状態で絞り込み")
    is_featured: Optional[int] = Field(None, description="おすすめ商品のみ")
    search: Optional[str] = Field(None, description="商品名で検索")
