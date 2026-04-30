"""
Consumer Router - B2C会員管理
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_from_token
from app.core.dependencies import get_current_consumer, get_line_user_id
from app.models import Consumer
from app.schemas import (
    ConsumerAuthRequest,
    ConsumerAuthResponse,
    ConsumerRegisterRequest,
    ConsumerProfileCompleteRequest,
    ConsumerUpdateRequest,
    ConsumerResponse,
    OrganizationList,
)
from app.models import Consumer, Organization


router = APIRouter()


@router.get("/organizations", response_model=OrganizationList)
async def get_organizations(
    db: AsyncSession = Depends(get_db)
):
    """Get list of available organizations."""
    stmt = select(Organization)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {"items": items, "total": len(items)}


def _normalize_building(value: str | None) -> str | None:
    """Normalize building input (treat 'なし' as None)."""
    if value is None:
        return None
    normalized = value.strip()
    if normalized == "":
        return None
    if normalized in {"なし", "無し", "ナシ", "なしです"}:
        return None
    return value


@router.post("/auth/verify", response_model=ConsumerAuthResponse)
async def verify_consumer(
    auth_request: ConsumerAuthRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify LINE token and auto-register if new user.
    LINE IDだけで仮登録し、すぐにアプリを利用できるようにする。
    """
    user_info = await get_current_user_from_token(auth_request.id_token)
    line_user_id = user_info["user_id"]

    stmt = select(Consumer).where(Consumer.line_user_id == line_user_id)
    result = await db.execute(stmt)
    consumer = result.scalar_one_or_none()

    if not consumer:
        # 自動仮登録: LINE IDだけでConsumerレコードを作成
        consumer = Consumer(
            line_user_id=line_user_id,
            name=user_info.get("name"),  # LINEプロフィール名があれば使う
            profile_image_url=user_info.get("picture"),
        )
        db.add(consumer)
        await db.commit()
        await db.refresh(consumer)

    return ConsumerAuthResponse(
        line_user_id=line_user_id,
        consumer=consumer,
        is_registered=True,
        message="会員情報を取得しました"
    )


@router.post("/register", response_model=ConsumerResponse, status_code=status.HTTP_201_CREATED)
async def register_consumer(
    register_request: ConsumerRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register or update consumer account using LINE ID token."""
    user_info = await get_current_user_from_token(register_request.id_token)
    line_user_id = user_info["user_id"]

    stmt = select(Consumer).where(Consumer.line_user_id == line_user_id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        if register_request.name:
            existing.name = register_request.name
        if register_request.phone_number:
            existing.phone_number = register_request.phone_number
        await db.commit()
        await db.refresh(existing)
        return existing

    consumer = Consumer(
        line_user_id=line_user_id,
        name=register_request.name or user_info.get("name"),
        phone_number=register_request.phone_number,
    )
    db.add(consumer)
    await db.commit()
    await db.refresh(consumer)
    return consumer


@router.post("/profile/complete", response_model=ConsumerResponse)
async def complete_consumer_profile(
    profile_data: ConsumerProfileCompleteRequest,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """注文前にプロフィール（名前・電話番号）を完成させる."""
    consumer.name = profile_data.name
    consumer.phone_number = profile_data.phone_number
    await db.commit()
    await db.refresh(consumer)
    return consumer


@router.get("/me", response_model=ConsumerResponse)
async def get_my_consumer_profile(
    consumer: Consumer = Depends(get_current_consumer)
):
    """Get current consumer profile."""
    return consumer


@router.put("/me", response_model=ConsumerResponse)
async def update_my_consumer_profile(
    update_request: ConsumerUpdateRequest,
    consumer: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db)
):
    """Update consumer profile fields."""
    update_data = update_request.model_dump(exclude_unset=True)

    if "building" in update_data:
        update_data["building"] = _normalize_building(update_data.get("building"))

    for field, value in update_data.items():
        setattr(consumer, field, value)

    await db.commit()
    await db.refresh(consumer)
    return consumer


@router.get("/check", response_model=ConsumerAuthResponse)
async def check_consumer_status(
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Check registration status using Authorization header token."""
    stmt = select(Consumer).where(Consumer.line_user_id == line_user_id)
    result = await db.execute(stmt)
    consumer = result.scalar_one_or_none()

    return ConsumerAuthResponse(
        line_user_id=line_user_id,
        consumer=consumer,
        is_registered=consumer is not None,
        message="会員情報を取得しました" if consumer else "会員登録が必要です"
    )
