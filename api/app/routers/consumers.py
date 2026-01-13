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
    ConsumerUpdateRequest,
    ConsumerResponse,
)

router = APIRouter()


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
    """Verify LINE token and return consumer registration status."""
    user_info = await get_current_user_from_token(auth_request.id_token)
    line_user_id = user_info["user_id"]

    stmt = select(Consumer).where(Consumer.line_user_id == line_user_id)
    result = await db.execute(stmt)
    consumer = result.scalar_one_or_none()

    return ConsumerAuthResponse(
        line_user_id=line_user_id,
        consumer=consumer,
        is_registered=consumer is not None,
        message="会員情報を取得しました" if consumer else "会員登録が必要です"
    )


@router.post("/register", response_model=ConsumerResponse, status_code=status.HTTP_201_CREATED)
async def register_consumer(
    register_request: ConsumerRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new consumer account using LINE ID token."""
    user_info = await get_current_user_from_token(register_request.id_token)
    line_user_id = user_info["user_id"]

    stmt = select(Consumer).where(Consumer.line_user_id == line_user_id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    building = _normalize_building(register_request.building)

    if existing:
        # Update existing record to keep latest info
        existing.name = register_request.name
        existing.phone_number = register_request.phone_number
        existing.postal_code = register_request.postal_code
        existing.address = register_request.address
        existing.building = building
        await db.commit()
        await db.refresh(existing)
        return existing

    consumer = Consumer(
        line_user_id=line_user_id,
        name=register_request.name,
        phone_number=register_request.phone_number,
        postal_code=register_request.postal_code,
        address=register_request.address,
        building=building,
    )
    db.add(consumer)
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
