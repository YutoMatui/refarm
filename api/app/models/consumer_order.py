"""
ConsumerOrder and ConsumerOrderItem models - 一般消費者向け注文
"""
from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    String,
    Text,
    Enum,
    Index
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import OrderStatus, DeliverySlotType


class ConsumerOrder(Base, TimestampMixin):
    """一般消費者向け注文 (ConsumerOrder) モデル."""

    __tablename__ = "consumer_orders"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="注文ID"
    )

    consumer_id = Column(
        Integer,
        ForeignKey("consumers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="消費者ID"
    )

    delivery_slot_id = Column(
        Integer,
        ForeignKey("delivery_slots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="選択した受取枠ID"
    )

    delivery_type = Column(
        Enum(DeliverySlotType),
        nullable=False,
        comment="受取方法"
    )

    delivery_label = Column(
        String(120),
        nullable=False,
        comment="受取方法表示名"
    )

    delivery_time_label = Column(
        String(120),
        nullable=False,
        comment="受取時間表示名"
    )

    delivery_address = Column(
        String(500),
        nullable=True,
        comment="配送先住所 (自宅配送時)"
    )

    delivery_notes = Column(
        Text,
        nullable=True,
        comment="受取に関するメモ"
    )

    payment_method = Column(
        String(50),
        nullable=False,
        default="cash_on_delivery",
        comment="支払い方法"
    )

    order_notes = Column(
        Text,
        nullable=True,
        comment="注文メモ"
    )

    status = Column(
        Enum(OrderStatus),
        nullable=False,
        default=OrderStatus.PENDING,
        index=True,
        comment="注文ステータス"
    )

    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="商品小計 (税抜)"
    )

    tax_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="消費税額"
    )

    shipping_fee = Column(
        Integer,
        nullable=False,
        default=0,
        comment="送料"
    )

    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="支払総額"
    )

    confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="注文確定日時"
    )

    delivered_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="受け渡し完了日時"
    )

    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="キャンセル日時"
    )

    consumer = relationship(
        "Consumer",
        back_populates="orders"
    )

    delivery_slot = relationship(
        "DeliverySlot",
        back_populates="orders"
    )

    order_items = relationship(
        "ConsumerOrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_consumer_orders_consumer_status", "consumer_id", "status"),
        {'comment': '一般消費者向け注文テーブル'}
    )

    def __repr__(self) -> str:
        return f"<ConsumerOrder(id={self.id}, consumer_id={self.consumer_id}, status='{self.status.value}')>"


class ConsumerOrderItem(Base, TimestampMixin):
    """一般消費者向け注文明細 (ConsumerOrderItem) モデル."""

    __tablename__ = "consumer_order_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="注文明細ID"
    )

    order_id = Column(
        Integer,
        ForeignKey("consumer_orders.id", ondelete="CASCADE"),
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

    quantity = Column(
        Integer,
        nullable=False,
        comment="数量"
    )

    unit_price = Column(
        Numeric(10, 2),
        nullable=False,
        comment="単価 (税抜)"
    )

    tax_rate = Column(
        Integer,
        nullable=False,
        comment="税率"
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
        comment="税込金額"
    )

    product_name = Column(
        String(200),
        nullable=False,
        comment="商品名スナップショット"
    )

    product_unit = Column(
        String(20),
        nullable=False,
        comment="単位スナップショット"
    )

    order = relationship(
        "ConsumerOrder",
        back_populates="order_items"
    )

    product = relationship("Product")

    __table_args__ = (
        {'comment': '一般消費者向け注文明細テーブル'}
    )

    def __repr__(self) -> str:
        return f"<ConsumerOrderItem(id={self.id}, order_id={self.order_id}, product_name='{self.product_name}')>"
