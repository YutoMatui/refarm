"""
Authentication API Router - LINE LIFF認証
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_line_user_id
from app.models import Restaurant
from app.schemas import RestaurantResponse

router = APIRouter()


class AuthRequest(BaseModel):
    """Authentication request with LINE ID Token."""
    id_token: str


class AuthResponse(BaseModel):
    """Authentication response."""
    line_user_id: str
    restaurant: RestaurantResponse | None
    is_registered: bool
    message: str


@router.post("/verify", response_model=AuthResponse, summary="LINE ID Token検証")
async def verify_line_token(
    auth_request: AuthRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    LINE ID Tokenを検証し、ユーザー情報を取得します。
    
    セキュリティ:
    - フロントエンドから送られた ID Token をLINEのサーバーで検証
    - なりすまし防止のため、LINE User ID を直接受け取らない
    
    Flow:
    1. LIFF SDK が ID Token を取得
    2. フロントエンドが ID Token をバックエンドに送信
    3. バックエンドが LINE のサーバーに問い合わせて検証
    4. 検証成功したら LINE User ID を取得
    5. 飲食店の登録状況を確認して返す
    """
    from app.core.security import get_current_user_from_token
    
    # Verify token with LINE's server
    user_info = await get_current_user_from_token(auth_request.id_token)
    line_user_id = user_info["user_id"]
    
    # Check if restaurant is registered
    stmt = select(Restaurant).where(
        Restaurant.line_user_id == line_user_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if restaurant:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=restaurant,
            is_registered=True,
            message="認証成功: 飲食店情報が見つかりました"
        )
    else:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=None,
            is_registered=False,
            message="認証成功: 飲食店の登録が必要です"
        )


@router.get("/me", response_model=RestaurantResponse, summary="現在の飲食店情報を取得")
async def get_my_restaurant(
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    認証済みユーザーの飲食店情報を取得します。
    
    Authorization header required: "Bearer {id_token}"
    """
    stmt = select(Restaurant).where(
        Restaurant.line_user_id == line_user_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="飲食店が登録されていません"
        )
    
    return restaurant
