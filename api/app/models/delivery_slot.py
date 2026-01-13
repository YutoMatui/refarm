"""
DeliverySlot model - B2C消費者向け受取枠
"""
from sqlalchemy import Column, Integer, Date, Time, String, Boolean, Enum, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import DeliverySlotType


class DeliverySlot(Base, TimestampMixin):
    """B2C向けの受取枠 (配送枠) モデル."""

    __tablename__ = "delivery_slots"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="受取枠ID"
    )

    date = Column(
        Date,
        nullable=False,
        index=True,
        comment="対象日"
    )

    slot_type = Column(
        Enum(DeliverySlotType),
        nullable=False,
        comment="枠種別 (HOME/UNIV)"
    )

    start_time = Column(
        Time,
        nullable=True,
        comment="開始時刻"
    )

    end_time = Column(
        Time,
        nullable=True,
        comment="終了時刻"
    )

    time_text = Column(
        String(120),
        nullable=False,
        comment="表示用時間テキスト"
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="公開フラグ"
    )

    note = Column(
        String(255),
        nullable=True,
        comment="備考"
    )

    orders = relationship(
        "ConsumerOrder",
        back_populates="delivery_slot"
    )

    __table_args__ = (
        Index("ix_delivery_slots_date_type", "date", "slot_type"),
        {'comment': 'B2C受取枠テーブル'}
    )

    def __repr__(self) -> str:
        return f"<DeliverySlot(id={self.id}, date={self.date}, slot_type='{self.slot_type.value}')>"
