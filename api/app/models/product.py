"""
Product model - 商品情報
"""
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin
from app.models.enums import StockType, TaxRate, ProductCategory, HarvestStatus, FarmingMethod


class Product(Base, TimestampMixin, SoftDeleteMixin):
    """
    商品 (Product) モデル
    
    神戸野菜とその他の野菜を区別して管理
    """
    __tablename__ = "products"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="商品ID"
    )
    
    # Foreign Keys
    farmer_id = Column(
        Integer,
        ForeignKey("farmers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="生産者ID (市場品はNULL)"
    )
    
    # Basic Information
    name = Column(
        String(200),
        nullable=False,
        comment="商品名"
    )
    
    description = Column(
        Text,
        nullable=True,
        comment="商品説明"
    )
    
    # Detailed Info
    variety = Column(
        String(200),
        nullable=True,
        comment="品種"
    )

    farming_method = Column(
        String(50),
        nullable=True,
        default=FarmingMethod.CONVENTIONAL.value,
        comment="栽培方法"
    )

    weight = Column(
        Integer,
        nullable=True,
        comment="重量(g)"
    )

    # Pricing
    price = Column(
        Numeric(10, 2),
        nullable=False,
        comment="単価 (税抜) - 販売価格"
    )

    cost_price = Column(
        Integer,
        nullable=True,
        comment="仕入れ値 (農家手取り)"
    )

    price_multiplier = Column(
        Numeric(4, 2),
        nullable=False,
        default=0.8,
        comment="価格調整係数 (仕入れ値 ÷ この値 × 1.08で販売価格を算出)"
    )
    
    harvest_status = Column(
        String(50),
        nullable=True,
        default=HarvestStatus.HARVESTABLE.value,
        comment="収穫状況"
    )
    
    tax_rate = Column(
        Enum(TaxRate),
        nullable=False,
        default=TaxRate.REDUCED,
        comment="税率 (8% or 10%)"
    )
    
    unit = Column(
        String(20),
        nullable=False,
        default="個",
        comment="単位 (個, kg, パックなど)"
    )
    
    # Stock Classification
    stock_type = Column(
        Enum(StockType),
        nullable=False,
        index=True,
        comment="種別 (KOBE: 神戸野菜, OTHER: その他の野菜)"
    )
    
    category = Column(
        Enum(ProductCategory),
        nullable=True,
        index=True,
        comment="カテゴリ (葉物, 根菜など)"
    )
    
    # Inventory Management
    stock_quantity = Column(
        Integer,
        nullable=True,
        default=50,
        comment="在庫数 (神戸野菜のみ管理)"
    )
    
    # Media & Story
    image_url = Column(
        String(500),
        nullable=True,
        comment="商品画像URL"
    )
    
    media_url = Column(
        String(500),
        nullable=True,
        comment="動画・POP素材URL"
    )
    
    # Product Status
    is_active = Column(
        Integer,
        nullable=False,
        default=1,
        comment="販売可否 (0: 販売停止, 1: 販売中)"
    )
    
    is_featured = Column(
        Integer,
        nullable=False,
        default=0,
        comment="おすすめフラグ (0: 通常, 1: おすすめ)"
    )

    is_wakeari = Column(
        Integer,  # Boolean-like integer (0: False, 1: True)
        nullable=False,
        default=0,
        comment="訳ありフラグ (0: 通常, 1: 訳あり)"
    )
    
    # Sorting
    display_order = Column(
        Integer,
        nullable=False,
        default=0,
        comment="表示順序"
    )
    
    # Relationships
    farmer = relationship(
        "Farmer",
        back_populates="products"
    )
    
    order_items = relationship(
        "OrderItem",
        back_populates="product"
    )
    
    favorites = relationship(
        "Favorite",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index('ix_products_stock_type_active', 'stock_type', 'is_active'),
        Index('ix_products_category_active', 'category', 'is_active'),
        Index('ix_products_farmer_id_active', 'farmer_id', 'is_active'),
        {'comment': '商品テーブル'}
    )
    
    @property
    def price_with_tax(self) -> float:
        """税込価格を計算"""
        if self.cost_price and self.cost_price > 0:
            return round(float(self.cost_price) / 0.8)
        return float(self.price) * (1 + int(self.tax_rate.value) / 100)
    
    @property
    def is_kobe_veggie(self) -> bool:
        """神戸野菜かどうか"""
        return self.stock_type == StockType.KOBE
    
    def __repr__(self) -> str:
        return f"<Product(id={self.id}, name='{self.name}', stock_type='{self.stock_type.value}')>"
