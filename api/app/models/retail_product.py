"""
RetailProduct, ProcurementBatch, ProcurementItem models - 消費者向け小売商品 & 仕入れ管理
"""
from sqlalchemy import (
    Column, Integer, Numeric, DateTime, ForeignKey, String, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class RetailProduct(Base, TimestampMixin, SoftDeleteMixin):
    """消費者向け小売商品 (RetailProduct) モデル.
    管理者が農家の卸商品をもとに作成する、消費者が閲覧・購入する商品。
    """
    __tablename__ = "retail_products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    source_product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="仕入れ元の農家商品"
    )
    name = Column(String(200), nullable=False, comment="消費者向け商品名")
    description = Column(Text, nullable=True, comment="消費者向け説明文")
    retail_price = Column(Numeric(10, 2), nullable=False, comment="小売価格（税抜）")
    tax_rate = Column(Integer, nullable=False, default=8, comment="税率")
    retail_unit = Column(String(20), nullable=False, default="パック", comment="販売単位")
    retail_quantity_label = Column(String(50), nullable=True, comment="表示用ラベル（3個入り等）")
    conversion_factor = Column(
        Numeric(10, 4), nullable=False, default=1.0,
        comment="農家1単位あたりの小売数量"
    )
    waste_margin_pct = Column(Integer, nullable=False, default=20, comment="廃棄マージン%")
    image_url = Column(String(500), nullable=True, comment="商品画像URL")
    category = Column(String(20), nullable=True, comment="カテゴリ")
    is_active = Column(Integer, nullable=False, default=1, comment="販売中フラグ")
    is_featured = Column(Integer, nullable=False, default=0, comment="おすすめフラグ")
    is_wakeari = Column(Integer, nullable=False, default=0, comment="訳ありフラグ")
    display_order = Column(Integer, nullable=False, default=0, comment="表示順")

    source_product = relationship("Product", foreign_keys=[source_product_id])

    __table_args__ = ({'comment': '消費者向け小売商品テーブル'},)

    def __repr__(self):
        return f"<RetailProduct(id={self.id}, name='{self.name}')>"


class ProcurementBatch(Base, TimestampMixin):
    """仕入れバッチ (ProcurementBatch) モデル.
    配送スロットごとに消費者注文を集約し、農家への一括発注を管理する。
    """
    __tablename__ = "procurement_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    delivery_slot_id = Column(
        Integer,
        ForeignKey("delivery_slots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="対象配送スロット"
    )
    status = Column(String(20), nullable=False, default="COLLECTING", comment="ステータス")
    cutoff_at = Column(DateTime(timezone=True), nullable=True, comment="注文締切日時")
    aggregated_at = Column(DateTime(timezone=True), nullable=True, comment="集計実行日時")
    ordered_at = Column(DateTime(timezone=True), nullable=True, comment="農家発注日時")
    notes = Column(Text, nullable=True, comment="メモ")

    delivery_slot = relationship("DeliverySlot")
    items = relationship("ProcurementItem", back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = ({'comment': '仕入れバッチテーブル'},)

    def __repr__(self):
        return f"<ProcurementBatch(id={self.id}, status='{self.status}')>"


class ProcurementItem(Base, TimestampMixin):
    """仕入れ明細 (ProcurementItem) モデル.
    バッチ内の各農家商品ごとの発注数量。
    """
    __tablename__ = "procurement_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(
        Integer,
        ForeignKey("procurement_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="バッチID"
    )
    source_product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        comment="農家商品"
    )
    retail_product_id = Column(
        Integer,
        ForeignKey("retail_products.id", ondelete="RESTRICT"),
        nullable=False,
        comment="小売商品"
    )
    total_retail_qty = Column(Integer, nullable=False, default=0, comment="消費者注文合計（小売単位）")
    calculated_farmer_qty = Column(Numeric(10, 2), nullable=False, default=0, comment="計算上の農家単位数")
    ordered_farmer_qty = Column(Integer, nullable=False, default=0, comment="実際発注数")
    unit_cost = Column(Numeric(10, 2), nullable=True, comment="仕入値スナップショット")
    notes = Column(Text, nullable=True, comment="メモ")

    batch = relationship("ProcurementBatch", back_populates="items")
    source_product = relationship("Product", foreign_keys=[source_product_id])
    retail_product = relationship("RetailProduct", foreign_keys=[retail_product_id])

    __table_args__ = ({'comment': '仕入れ明細テーブル'},)

    def __repr__(self):
        return f"<ProcurementItem(id={self.id}, batch_id={self.batch_id})>"
