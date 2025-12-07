"""
Favorite model - お気に入り商品
"""
from sqlalchemy import Column, Integer, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class Favorite(Base, TimestampMixin):
    """
    お気に入り (Favorite) モデル
    
    飲食店が商品をお気に入り登録
    """
    __tablename__ = "favorites"
    
    # Primary Key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="お気に入りID"
    )
    
    # Foreign Keys
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        comment="飲食店ID"
    )
    
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        comment="商品ID"
    )
    
    # Additional Information
    notes = Column(
        Integer,
        nullable=True,
        comment="メモ・備考"
    )
    
    # Relationships
    restaurant = relationship(
        "Restaurant",
        back_populates="favorites"
    )
    
    product = relationship(
        "Product",
        back_populates="favorites"
    )
    
    # Constraints & Indexes
    __table_args__ = (
        UniqueConstraint('restaurant_id', 'product_id', name='uq_restaurant_product'),
        Index('ix_favorites_restaurant_id', 'restaurant_id'),
        Index('ix_favorites_product_id', 'product_id'),
        {'comment': 'お気に入りテーブル'}
    )
    
    def __repr__(self) -> str:
        return f"<Favorite(id={self.id}, restaurant_id={self.restaurant_id}, product_id={self.product_id})>"
