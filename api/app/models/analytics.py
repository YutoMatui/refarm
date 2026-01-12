from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class FarmerFollow(Base, TimestampMixin):
    """
    生産者フォロー (FarmerFollow)
    
    飲食店が生産者をフォローする
    """
    __tablename__ = "farmer_follows"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Relationships
    restaurant = relationship("Restaurant")
    farmer = relationship("Farmer")
    
    __table_args__ = (
        UniqueConstraint('restaurant_id', 'farmer_id', name='uq_farmer_follow'),
    )
