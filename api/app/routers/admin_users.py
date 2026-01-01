"""
Admin Users Router - 管理者による管理者管理
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.admin import Admin
from app.routers.admin_auth import get_current_admin

router = APIRouter()

# Schema
class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "editor" # super_admin or editor

class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None

class AdminUserResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Dependency: Check if current user is Super Admin
async def get_current_super_admin(current_admin: Admin = Depends(get_current_admin)):
    if current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者権限が必要です（Super Admin only）"
        )
    return current_admin

@router.get("/", response_model=List[AdminUserResponse])
async def list_admin_users(
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_super_admin)
):
    """管理者一覧を取得"""
    stmt = select(Admin).order_by(Admin.id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=AdminUserResponse)
async def create_admin_user(
    user_data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_super_admin)
):
    """管理者を追加"""
    # Check duplicate
    stmt = select(Admin).where(Admin.email == user_data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")

    new_admin = Admin(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role
    )
    db.add(new_admin)
    await db.commit()
    await db.refresh(new_admin)
    return new_admin

@router.put("/{admin_id}", response_model=AdminUserResponse)
async def update_admin_user(
    admin_id: int,
    user_data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_super_admin)
):
    """管理者情報を更新（パスワード変更含む）"""
    stmt = select(Admin).where(Admin.id == admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(status_code=404, detail="管理者が見つかりません")

    if user_data.email:
        admin.email = user_data.email
    
    if user_data.password:
        admin.hashed_password = get_password_hash(user_data.password)
        
    if user_data.role:
        admin.role = user_data.role

    await db.commit()
    await db.refresh(admin)
    return admin

@router.delete("/{admin_id}")
async def delete_admin_user(
    admin_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_super_admin)
):
    """管理者を削除"""
    if admin_id == current_admin.id:
        raise HTTPException(status_code=400, detail="自分自身を削除することはできません")

    stmt = select(Admin).where(Admin.id == admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    
    if not admin:
        raise HTTPException(status_code=404, detail="管理者が見つかりません")

    await db.delete(admin)
    await db.commit()
    return {"message": "削除しました"}
