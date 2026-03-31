"""
Settlement Status model - 月次入金/振込ステータス
"""
from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.base import TimestampMixin


class SettlementStatus(Base, TimestampMixin):
    """
    月次の入金/振込ステータスを管理するテーブル

    - user_type: "restaurant" | "farmer"
    - target_month: "YYYY-MM"
    - status: "pending" | "completed"
    """

    __tablename__ = "settlement_statuses"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="ステータスID"
    )

    user_type = Column(
        String(20),
        nullable=False,
        index=True,
        comment="対象種別（restaurant/farmer）"
    )

    user_id = Column(
        Integer,
        nullable=False,
        index=True,
        comment="対象ユーザーID"
    )

    target_month = Column(
        String(7),
        nullable=False,
        index=True,
        comment="対象月 (YYYY-MM)"
    )

    status = Column(
        String(20),
        nullable=False,
        server_default="pending",
        comment="ステータス (pending/completed)"
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="完了日時"
    )

    __table_args__ = (
        Index("ix_settlement_statuses_user_month", "user_type", "user_id", "target_month", unique=True),
        {"comment": "月次入金/振込ステータステーブル"}
    )

    def __repr__(self) -> str:
        return f"<SettlementStatus(user_type={self.user_type}, user_id={self.user_id}, target_month={self.target_month}, status={self.status})>"
