from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, String
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


class AccessLog(Base, TimestampMixin):
    """
    Access log for restaurant/farmer activity.
    """
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    actor_type = Column(String(32), nullable=False, index=True)  # restaurant / farmer
    actor_id = Column(Integer, nullable=True, index=True)
    actor_name = Column(String(255), nullable=True)
    line_user_id = Column(String(128), nullable=True, index=True)
    action = Column(String(64), nullable=True)
    path = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
