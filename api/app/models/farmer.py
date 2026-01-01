"""
Farmer model - 生産者情報
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class Farmer(Base, TimestampMixin, SoftDeleteMixin):
    """
    生産者 (Farmer) モデル
    
    農家の情報とストーリーを管理
    """
    __tablename__ = "farmers"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="生産者ID"
    )
    
    # Basic Information
    name = Column(
        String(200),
        nullable=False,
        comment="生産者名"
    )
    
    main_crop = Column(
        String(200),
        nullable=True,
        comment="主要作物"
    )
    
    # Visual & Story
    profile_photo_url = Column(
        String(500),
        nullable=True,
        comment="顔写真URL"
    )
    
    bio = Column(
        Text,
        nullable=True,
        comment="プロフィール・紹介文"
    )
    
    map_url = Column(
        String(500),
        nullable=True,
        comment="農園MAPリンク (外部サイト)"
    )
    
    # Contact Information
    email = Column(
        String(200),
        nullable=True,
        comment="メールアドレス"
    )
    
    phone_number = Column(
        String(20),
        nullable=True,
        comment="電話番号"
    )
    
    address = Column(
        String(500),
        nullable=True,
        comment="農園所在地"
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
    
    # Content for Detail Page
    article_url = Column(
        JSON,
        nullable=True,
        comment="記事URL (JSON Array)"
    )

    video_url = Column(
        JSON,
        nullable=True,
        comment="動画URL (JSON Array)"
    )
    
    # Additional Information
    farming_method = Column(
        String(200),
        nullable=True,
        comment="栽培方法 (有機, 減農薬など)"
    )
    
    certifications = Column(
        String(500),
        nullable=True,
        comment="認証情報 (JAS有機など)"
    )

    # New fields for detail page enhancement
    cover_photo_url = Column(
        String(500),
        nullable=True,
        comment="背景（カバー）画像URL"
    )

    commitments = Column(
        JSON,
        nullable=True,
        comment="こだわり情報 (JSON Array: [{title, body, image_url}])"
    )

    achievements = Column(
        JSON,
        nullable=True,
        comment="実績リスト (JSON Array: [string])"
    )

    chef_comments = Column(
        JSON,
        nullable=True,
        comment="シェフからのコメント (JSON Array: [{comment, chef_name, restaurant_name, image_url}])"
    )

    kodawari = Column(
        String(1000),
        nullable=True,
        comment="農家のこだわり"
    )

    selectable_days = Column(
        String(100),
        nullable=True,
        comment="選択可能曜日 (JSON: [0,1,2...])"
    )
    
    is_active = Column(
        Integer,
        nullable=False,
        default=1,
        comment="アクティブフラグ (0: 無効, 1: 有効)"
    )
    
    # Invitation System
    invite_token = Column(String(64), nullable=True, index=True)
    invite_code = Column(String(10), nullable=True)
    invite_expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    products = relationship(
        "Product",
        back_populates="farmer",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        {'comment': '生産者テーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<Farmer(id={self.id}, name='{self.name}', main_crop='{self.main_crop}')>"
