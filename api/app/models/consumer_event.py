"""
ConsumerEvent model - 消費者行動ログ
"""
from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class ConsumerEvent(Base, TimestampMixin):
    """消費者の行動イベントログ"""
    __tablename__ = "consumer_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    consumer_id = Column(Integer, ForeignKey("consumers.id", ondelete="SET NULL"), nullable=True, index=True, comment="消費者ID")
    session_id = Column(String(64), nullable=True, index=True, comment="セッションID")
    event_type = Column(String(50), nullable=False, index=True, comment="イベント種別")
    page = Column(String(255), nullable=True, comment="ページパス")
    product_id = Column(Integer, nullable=True, index=True, comment="関連商品ID")
    product_name = Column(String(200), nullable=True, comment="商品名スナップショット")
    farmer_id = Column(Integer, nullable=True, comment="関連農家ID")
    farmer_name = Column(String(200), nullable=True, comment="農家名スナップショット")
    quantity = Column(Integer, nullable=True, comment="数量（カート操作時）")
    search_query = Column(String(200), nullable=True, comment="検索キーワード")
    cart_item_count = Column(Integer, nullable=True, comment="カート内商品数")
    cart_total = Column(Integer, nullable=True, comment="カート合計金額")
    metadata_ = Column("metadata", JSON, nullable=True, comment="追加データ")
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)

    __table_args__ = (
        Index("ix_consumer_events_type_created", "event_type", "created_at"),
        Index("ix_consumer_events_consumer_type", "consumer_id", "event_type"),
        {'comment': '消費者行動イベントログテーブル'}
    )
