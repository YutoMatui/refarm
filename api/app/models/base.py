"""
Base model with common fields and utilities.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.sql import func


class TimestampMixin:
    """Mixin to add timestamp fields to models."""
    
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="作成日時"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新日時"
    )


class SoftDeleteMixin:
    """Mixin to add soft delete functionality."""
    
    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="削除日時"
    )
    
    @property
    def is_deleted(self) -> bool:
        """Check if record is soft-deleted."""
        return self.deleted_at is not None
