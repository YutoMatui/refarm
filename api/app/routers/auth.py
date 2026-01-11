"""
Authentication API Router - LINE LIFF認証
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import secrets
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.dependencies import get_line_user_id
from app.models import Restaurant, Farmer
from app.schemas import RestaurantResponse, FarmerResponse
from typing import Optional

router = APIRouter()


class LinkAccountRequest(BaseModel):
    """Request schema for linking account."""
    line_user_id: str
    invite_token: str
    input_code: str


@router.post("/link_account", summary="アカウント連携（招待コード）")
async def link_account(
    req: LinkAccountRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    招待URLと認証コードを使用して、LINEアカウントを既存の生産者・飲食店データに紐付けます。
    """
    # 1. Check Farmer invitations
    stmt_farmer = select(Farmer).where(
        Farmer.invite_token == req.invite_token,
        Farmer.invite_expires_at > datetime.now()
    )
    result_farmer = await db.execute(stmt_farmer)
    farmer = result_farmer.scalar_one_or_none()

    if farmer:
        # Verify code
        if farmer.invite_code != req.input_code:
            raise HTTPException(status_code=400, detail="認証コードが間違っています。")
        
        # Link account
        farmer.line_user_id = req.line_user_id
        # Invalidate token
        farmer.invite_token = None
        farmer.invite_code = None
        farmer.invite_expires_at = None
        
        await db.commit()
        return {"message": "連携が完了しました！", "name": farmer.name, "role": "farmer", "target_id": farmer.id}

    # 2. Check Restaurant invitations
    stmt_restaurant = select(Restaurant).where(
        Restaurant.invite_token == req.invite_token,
        Restaurant.invite_expires_at > datetime.now()
    )
    result_restaurant = await db.execute(stmt_restaurant)
    restaurant = result_restaurant.scalar_one_or_none()

    if restaurant:
        # Verify code
        if restaurant.invite_code != req.input_code:
            raise HTTPException(status_code=400, detail="認証コードが間違っています。")
            
        # Link account
        restaurant.line_user_id = req.line_user_id
        # Invalidate token
        restaurant.invite_token = None
        restaurant.invite_code = None
        restaurant.invite_expires_at = None
        
        await db.commit()
        return {"message": "連携が完了しました！", "name": restaurant.name, "role": "restaurant", "target_id": restaurant.id}

    raise HTTPException(status_code=400, detail="招待URLが無効か、期限切れです。管理者に再発行を依頼してください。")


class AuthRequest(BaseModel):
    """Authentication request with LINE ID Token."""
    id_token: str


class AuthResponse(BaseModel):
    """Authentication response."""
    line_user_id: str
    restaurant: RestaurantResponse | None
    farmer: FarmerResponse | None = None
    role: str | None = None  # 'restaurant', 'farmer', or None
    is_registered: bool
    message: str


class RegisterRequest(BaseModel):
    """Registration request."""
    id_token: str
    name: str
    phone_number: str
    address: str
    invoice_email: str | None = None
    business_hours: str | None = None
    notes: str | None = None


@router.post("/register", response_model=AuthResponse, summary="飲食店新規登録")
async def register_restaurant(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    LINE ID Tokenを使用して飲食店を新規登録します。
    """
    from app.core.security import get_current_user_from_token
    
    # Verify token
    user_info = await get_current_user_from_token(register_data.id_token)
    line_user_id = user_info["user_id"]
    
    # Check if already registered
    stmt = select(Restaurant).where(
        Restaurant.line_user_id == line_user_id,
        Restaurant.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    existing_restaurant = result.scalar_one_or_none()
    
    if existing_restaurant:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=existing_restaurant,
            is_registered=True,
            message="既に登録されています"
        )
    
    # Create new restaurant
    new_restaurant = Restaurant(
        line_user_id=line_user_id,
        name=register_data.name,
        phone_number=register_data.phone_number,
        address=register_data.address,
        invoice_email=register_data.invoice_email,
        business_hours=register_data.business_hours,
        notes=register_data.notes,
        is_active=1
    )
    
    db.add(new_restaurant)
    await db.commit()
    await db.refresh(new_restaurant)
    
    return AuthResponse(
        line_user_id=line_user_id,
        restaurant=new_restaurant,
        is_registered=True,
        message="登録が完了しました"
    )


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

    # Check if farmer is registered
    stmt_farmer = select(Farmer).where(
        Farmer.line_user_id == line_user_id,
        Farmer.deleted_at.is_(None)
    )
    result_farmer = await db.execute(stmt_farmer)
    farmer = result_farmer.scalar_one_or_none()

    # DEBUG MODE: If restaurant not found but it's a mock user, return a mock restaurant
    from app.core.config import settings
    # Check if it's a mock scenario
    is_mock_token = auth_request.id_token == 'mock-id-token' or auth_request.id_token.startswith('mock-') or len(auth_request.id_token) < 50
    
    if not restaurant and not farmer and settings.DEBUG and is_mock_token:
         from datetime import datetime
         dummy_restaurant = {
             "id": 999,
             "line_user_id": line_user_id,
             "name": "開発用デモ店舗",
             "phone_number": "090-0000-0000",
             "address": "開発環境",
             "invoice_email": "dev@example.com",
             "business_hours": "10:00-22:00",
             "notes": "開発用ダミーデータ",
             "is_active": 1,
             "created_at": datetime.now(),
             "updated_at": datetime.now()
         }
         return AuthResponse(
            line_user_id=line_user_id,
            restaurant=dummy_restaurant,
            role="restaurant",
            is_registered=True,
            message="認証成功: 開発用デモ店舗（モック）"
        )
    
    if restaurant:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=restaurant,
            role="restaurant",
            is_registered=True,
            message="認証成功: 飲食店情報が見つかりました"
        )
    elif farmer:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=None,
            farmer=farmer,
            role="farmer",
            is_registered=True,
            message="認証成功: 生産者情報が見つかりました"
        )
    else:
        return AuthResponse(
            line_user_id=line_user_id,
            restaurant=None,
            farmer=None,
            role=None,
            is_registered=False,
            message="認証成功: アカウントの登録または連携が必要です"
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
