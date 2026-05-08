"""
Coupon model - クーポン管理
"""
from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    DateTime,
    String,
    Boolean,
    Enum as SAEnum,
)

from app.core.database import Base
from app.models.base import TimestampMixin

import enum


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class Coupon(Base, TimestampMixin):
    """クーポンモデル"""

    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True, comment="クーポンコード")
    description = Column(String(200), nullable=True, comment="説明")
    discount_type = Column(SAEnum(DiscountType), nullable=False, comment="割引タイプ (percentage / fixed_amount)")
    discount_value = Column(Numeric(10, 2), nullable=False, comment="割引値 (% or 円)")
    min_order_amount = Column(Numeric(10, 2), nullable=False, default=0, comment="最低注文金額")
    max_uses = Column(Integer, nullable=True, comment="最大利用回数 (NULLで無制限)")
    used_count = Column(Integer, nullable=False, default=0, comment="利用済み回数")
    is_active = Column(Boolean, nullable=False, default=True, comment="有効フラグ")
    starts_at = Column(DateTime(timezone=True), nullable=True, comment="有効開始日時")
    expires_at = Column(DateTime(timezone=True), nullable=True, comment="有効期限")

    def __repr__(self) -> str:
        return f"<Coupon(id={self.id}, code='{self.code}', type='{self.discount_type.value}')>"
