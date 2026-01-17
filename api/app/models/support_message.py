"""
Support Message Model
消費者から生産者への応援メッセージ
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.models.base import Base


class SupportMessage(Base):
    """応援メッセージモデル"""
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    consumer_id = Column(Integer, ForeignKey("consumers.id", ondelete="CASCADE"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)  # 応援メッセージ本文
    nickname = Column(String(100), nullable=True)  # ニックネーム（任意）
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    consumer = relationship("Consumer", back_populates="support_messages")
    farmer = relationship("Farmer", back_populates="support_messages")
