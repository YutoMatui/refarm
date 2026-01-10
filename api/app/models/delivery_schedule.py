"""
Delivery Schedule model - 配送スケジュール
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class DeliverySchedule(Base, TimestampMixin):
    """
    配送スケジュール (DeliverySchedule) モデル
    
    特定の日付に対する配送可否、担当者を管理
    """
    __tablename__ = "delivery_schedules"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="スケジュールID"
    )
    
    # Schedule Details
    date = Column(
        Date,
        nullable=False,
        unique=True,
        index=True,
        comment="対象日"
    )
    
    is_available = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="配送可能フラグ"
    )
    
    procurement_staff = Column(
        String(100),
        nullable=True,
        comment="仕入れ担当者名"
    )
    
    delivery_staff = Column(
        String(100),
        nullable=True,
        comment="配送担当者名"
    )

    time_slot = Column(
        String(100),
        nullable=True,
        comment="配送可能時間"
    )
    
    # Note: Day of week is derived from date, no need to store ideally, 
    # but if specific overrides are needed we can add logic. 
    # For now, following requirements: "Select date then select day of week (if needed?)"
    # Usually day of week is implicit. User said "Select date, then also select day of week".
    # This might mean they want to assign a "Logical Day" to a date (e.g. treating a holiday Monday as Sunday schedule?).
    # Or maybe they just want to see it. I'll stick to Date. 
    
    __table_args__ = (
        {'comment': '配送スケジュールテーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<DeliverySchedule(date={self.date}, is_available={self.is_available})>"
