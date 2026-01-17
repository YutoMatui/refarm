"""
Consumer model - B2C一般消費者
"""
from sqlalchemy import Column, Integer, String, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Consumer(Base, TimestampMixin):
    """一般消費者 (Consumer) モデル."""

    __tablename__ = "consumers"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="消費者ID"
    )

    line_user_id = Column(
        String(128),
        nullable=False,
        unique=True,
        comment="LINE User ID"
    )

    name = Column(
        String(200),
        nullable=False,
        comment="氏名"
    )

    phone_number = Column(
        String(20),
        nullable=False,
        comment="電話番号"
    )

    postal_code = Column(
        String(10),
        nullable=False,
        comment="郵便番号"
    )

    address = Column(
        String(500),
        nullable=False,
        comment="住所 (都道府県・市区町村・番地)"
    )

    building = Column(
        String(255),
        nullable=True,
        comment="建物名・部屋番号"
    )

    orders = relationship(
        "ConsumerOrder",
        back_populates="consumer",
        cascade="all, delete-orphan"
    )

    support_messages = relationship(
        "SupportMessage",
        back_populates="consumer",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_consumers_line_user_id", "line_user_id", unique=True),
        {'comment': '一般消費者テーブル'}
    )

    def __repr__(self) -> str:
        return f"<Consumer(id={self.id}, name='{self.name}')>"
