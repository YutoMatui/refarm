from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Organization(Base, TimestampMixin):
    """組織・企業 (Organization) モデル."""

    __tablename__ = "organizations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
        comment="組織ID"
    )

    name = Column(
        String(200),
        nullable=False,
        comment="組織名"
    )

    address = Column(
        String(500),
        nullable=False,
        comment="住所"
    )

    phone_number = Column(
        String(20),
        nullable=False,
        comment="電話番号"
    )

    consumers = relationship(
        "Consumer",
        back_populates="organization"
    )

    __table_args__ = (
        {'comment': '組織・企業テーブル'}
    )

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}')>"
