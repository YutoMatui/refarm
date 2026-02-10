"""
Farmer Schedule model - 農家別出荷可能日
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class FarmerSchedule(Base, TimestampMixin):
    """
    農家スケジュール (FarmerSchedule) モデル
    
    農家が個別に設定する出荷可能日/不可日
    """
    __tablename__ = "farmer_schedules"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="スケジュールID"
    )
    
    farmer_id = Column(
        Integer,
        ForeignKey("farmers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="生産者ID"
    )
    
    date = Column(
        Date,
        nullable=False,
        index=True,
        comment="対象日"
    )
    
    is_available = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="配送可能フラグ"
    )
    
    notes = Column(
        String(200),
        nullable=True,
        comment="備考"
    )
    
    # Relationships
    farmer = relationship(
        "Farmer",
        back_populates="schedules"
    )
    
    __table_args__ = (
        Index('ix_farmer_schedules_farmer_date', 'farmer_id', 'date', unique=True),
        {'comment': '農家スケジュールテーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<FarmerSchedule(farmer_id={self.farmer_id}, date={self.date}, is_available={self.is_available})>"
