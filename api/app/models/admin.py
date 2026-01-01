"""
Admin model - 管理者情報
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Admin(Base):
    """管理者テーブル"""
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False, comment="ログインID(Email)")
    hashed_password = Column(String(255), nullable=False, comment="ハッシュ化パスワード")
    role = Column(String(50), default="editor", nullable=False, comment="権限 (super_admin, editor, viewer)")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
