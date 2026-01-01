"""
Restaurant model - 飲食店情報
"""
from sqlalchemy import Column, Integer, String, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class Restaurant(Base, TimestampMixin, SoftDeleteMixin):
    """
    飲食店 (Restaurant) モデル
    
    LINE User IDを使用した自動ログインに対応
    """
    __tablename__ = "restaurants"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="飲食店ID"
    )
    
    # LINE Integration
    line_user_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="LINE User ID (認証用)"
    )
    
    # Basic Information
    name = Column(
        String(200),
        nullable=False,
        comment="店舗名"
    )
    
    phone_number = Column(
        String(20),
        nullable=False,
        comment="電話番号 (緊急連絡用)"
    )
    
    address = Column(
        String(500),
        nullable=False,
        comment="住所 (納品先)"
    )

    latitude = Column(
        String(50),
        nullable=True,
        comment="緯度"
    )

    longitude = Column(
        String(50),
        nullable=True,
        comment="経度"
    )

    delivery_window_start = Column(
        String(5),
        nullable=True,
        comment="配送希望開始時間 (HH:MM)"
    )

    delivery_window_end = Column(
        String(5),
        nullable=True,
        comment="配送希望終了時間 (HH:MM)"
    )
    
    invoice_email = Column(
        String(200),
        nullable=True,
        comment="請求書送付先メールアドレス"
    )
    
    # Additional Information
    business_hours = Column(
        String(200),
        nullable=True,
        comment="営業時間"
    )
    
    notes = Column(
        String(1000),
        nullable=True,
        comment="備考・特記事項"
    )
    
    is_active = Column(
        Integer,
        nullable=False,
        default=1,
        comment="アクティブフラグ (0: 無効, 1: 有効)"
    )

    # Enhanced Profile
    profile_photo_url = Column(
        String(500),
        nullable=True,
        comment="アイコン・プロフィール画像URL"
    )

    cuisine_type = Column(
        String(100),
        nullable=True,
        comment="業種（イタリアン、フレンチ、居酒屋など）"
    )

    kodawari = Column(
        String(1000), # Using String/Text for sqlite compatibility in simple setup
        nullable=True,
        comment="こだわり・お店の紹介"
    )

    closing_date = Column(
        Integer,
        default=99,
        nullable=True,
        comment="締め日 (1-28, 99=末日)"
    )
    
    # Invitation System
    invite_token = Column(String(64), nullable=True, index=True)
    invite_code = Column(String(10), nullable=True)
    invite_expires_at = Column(DateTime, nullable=True)

    # Relationships
    orders = relationship(
        "Order",
        back_populates="restaurant",
        cascade="all, delete-orphan"
    )
    
    favorites = relationship(
        "Favorite",
        back_populates="restaurant",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index('ix_restaurants_line_user_id_active', 'line_user_id', 'is_active'),
        {'comment': '飲食店テーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<Restaurant(id={self.id}, name='{self.name}', line_user_id='{self.line_user_id}')>"
