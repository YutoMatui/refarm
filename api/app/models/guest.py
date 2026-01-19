from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class GuestVisit(Base, TimestampMixin):
    """
    ゲスト訪問ログ (GuestVisit)
    
    消費者がQRコードからアクセスした際のセッション情報
    """
    __tablename__ = "guest_visits"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    visitor_id = Column(String(100), nullable=True, index=True, comment="訪問者ID (Cookie/UUID)")
    
    stay_time_seconds = Column(Integer, nullable=True, comment="滞在時間(秒)")
    scroll_depth = Column(Integer, nullable=True, comment="スクロール到達率(%)")
    
    # Relationships
    restaurant = relationship("Restaurant")
    interactions = relationship("GuestInteraction", back_populates="visit", cascade="all, delete-orphan")


class GuestInteraction(Base, TimestampMixin):
    """
    ゲストインタラクション (GuestInteraction)
    
    スタンプ送信、メッセージ送信、農家への興味などのアクション
    """
    __tablename__ = "guest_interactions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    visit_id = Column(Integer, ForeignKey("guest_visits.id"), nullable=False, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True, index=True)
    
    interaction_type = Column(String(50), nullable=False, comment="アクションタイプ (STAMP, MESSAGE, INTEREST)")
    stamp_type = Column(String(50), nullable=True, comment="スタンプの種類 (DELICIOUS, SUPPORT, etc.)")
    comment = Column(Text, nullable=True, comment="応援メッセージ本文")
    nickname = Column(String(100), nullable=True, comment="ニックネーム")
    user_image_url = Column(String(500), nullable=True, comment="ユーザーのプロフィール画像URL")
    
    # Relationships
    visit = relationship("GuestVisit", back_populates="interactions")
    farmer = relationship("Farmer")
