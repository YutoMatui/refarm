"""
Order and OrderItem models - 注文情報
"""
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, DateTime, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import DeliveryTimeSlot, OrderStatus


class Order(Base, TimestampMixin):
    """
    注文 (Order) モデル
    
    配送日時と時間枠を管理
    """
    __tablename__ = "orders"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="注文ID"
    )
    
    # Foreign Keys
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="飲食店ID"
    )
    
    # Delivery Information
    delivery_date = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="配送希望日"
    )
    
    delivery_time_slot = Column(
        Enum(DeliveryTimeSlot),
        nullable=False,
        comment="配送時間枠 (12-14, 14-16, 16-18)"
    )
    
    # Order Status
    status = Column(
        Enum(OrderStatus),
        nullable=False,
        default=OrderStatus.PENDING,
        index=True,
        comment="注文ステータス"
    )
    
    # Pricing Summary
    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="小計 (税抜)"
    )
    
    tax_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="消費税額"
    )
    
    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="合計金額 (税込)"
    )
    
    # Delivery Details
    delivery_address = Column(
        String(500),
        nullable=False,
        comment="配送先住所"
    )
    
    delivery_phone = Column(
        String(20),
        nullable=False,
        comment="配送先電話番号"
    )
    
    delivery_notes = Column(
        Text,
        nullable=True,
        comment="配送メモ・要望"
    )
    
    # Additional Information
    notes = Column(
        Text,
        nullable=True,
        comment="注文メモ"
    )
    
    invoice_url = Column(
        String(500),
        nullable=True,
        comment="請求書PDF URL"
    )
    
    # Timestamps for tracking
    confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="受注確定日時"
    )
    
    shipped_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="配送開始日時"
    )
    
    delivered_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="配達完了日時"
    )
    
    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="キャンセル日時"
    )
    
    # Relationships
    restaurant = relationship(
        "Restaurant",
        back_populates="orders"
    )
    
    order_items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index('ix_orders_restaurant_status', 'restaurant_id', 'status'),
        Index('ix_orders_delivery_date_status', 'delivery_date', 'status'),
        {'comment': '注文テーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<Order(id={self.id}, restaurant_id={self.restaurant_id}, status='{self.status.value}')>"


class OrderItem(Base, TimestampMixin):
    """
    注文明細 (Order Item) モデル
    
    価格と税率のスナップショットを保持
    """
    __tablename__ = "order_items"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="注文明細ID"
    )
    
    # Foreign Keys
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="注文ID"
    )
    
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="商品ID"
    )
    
    # Order Details
    quantity = Column(
        Integer,
        nullable=False,
        comment="数量"
    )
    
    # Price Snapshot (注文時の価格を保持)
    unit_price = Column(
        Numeric(10, 2),
        nullable=False,
        comment="単価 (税抜・スナップショット)"
    )
    
    tax_rate = Column(
        Integer,
        nullable=False,
        comment="税率 (スナップショット)"
    )
    
    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
        comment="小計 (税抜)"
    )
    
    tax_amount = Column(
        Numeric(10, 2),
        nullable=False,
        comment="消費税額"
    )
    
    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
        comment="合計金額 (税込)"
    )
    
    # Product Snapshot
    product_name = Column(
        String(200),
        nullable=False,
        comment="商品名 (スナップショット)"
    )
    
    product_unit = Column(
        String(20),
        nullable=False,
        comment="単位 (スナップショット)"
    )
    
    # Relationships
    order = relationship(
        "Order",
        back_populates="order_items"
    )
    
    product = relationship(
        "Product",
        back_populates="order_items"
    )
    
    # Indexes
    __table_args__ = (
        Index('ix_order_items_order_id', 'order_id'),
        {'comment': '注文明細テーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<OrderItem(id={self.id}, order_id={self.order_id}, product_name='{self.product_name}', quantity={self.quantity})>"
