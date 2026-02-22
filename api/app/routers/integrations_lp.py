"""
LP Integration Router - LPフォーム経由の飲食店連携
"""
from datetime import datetime, timedelta
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Restaurant

router = APIRouter()


class LpRegisterAndInviteRequest(BaseModel):
    shop_name: str = Field(..., min_length=1, max_length=200)
    contact_person: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=500)
    phone: str = Field(..., min_length=10, max_length=20)
    email: EmailStr


class LpRegisterAndInviteResponse(BaseModel):
    restaurant_id: int
    created: bool
    invite_url: str
    access_code: str
    expires_at: datetime


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _build_invite_url(token: str) -> str:
    liff_id = settings.RESTAURANT_LIFF_ID
    return f"https://liff.line.me/{liff_id}?token={token}&type=restaurant"


async def _authenticate_lp_request(x_lp_api_key: Optional[str] = Header(default=None, alias="x-lp-api-key")) -> None:
    configured_key = settings.LP_INTEGRATION_API_KEY
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LP integration key is not configured",
        )
    if not x_lp_api_key or not secrets.compare_digest(x_lp_api_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid integration API key",
        )


@router.post(
    "/register_and_invite",
    response_model=LpRegisterAndInviteResponse,
    summary="LP流入の飲食店登録と招待情報発行",
)
async def register_and_invite_from_lp(
    payload: LpRegisterAndInviteRequest,
    _: None = Depends(_authenticate_lp_request),
    db: AsyncSession = Depends(get_db),
):
    """
    LPフォーム入力を受けて飲食店を作成し、初回LINE連携用の招待URLと4桁コードを発行する。
    重複判定キーは invoice_email を使用する。
    """
    normalized_email = _normalize_email(str(payload.email))
    stmt = select(Restaurant).where(
        Restaurant.deleted_at.is_(None),
        func.lower(Restaurant.invoice_email) == normalized_email,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()

    created = False
    if existing:
        if existing.line_user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="既にLINE連携済みの飲食店です",
            )
        existing.name = payload.shop_name.strip()
        existing.phone_number = payload.phone.strip()
        existing.address = payload.address.strip()
        existing.invoice_email = normalized_email
        restaurant = existing
    else:
        created = True
        lp_note = (
            f"[LPv2] contact_person={payload.contact_person.strip()} "
            f"received_at={datetime.now().isoformat(timespec='seconds')}"
        )
        restaurant = Restaurant(
            name=payload.shop_name.strip(),
            phone_number=payload.phone.strip(),
            address=payload.address.strip(),
            invoice_email=normalized_email,
            notes=lp_note,
            is_active=1,
        )
        db.add(restaurant)

    new_token = secrets.token_urlsafe(32)
    new_code = str(secrets.randbelow(10000)).zfill(4)
    expires_at = datetime.now() + timedelta(days=7)
    restaurant.invite_token = new_token
    restaurant.invite_code = new_code
    restaurant.invite_expires_at = expires_at

    await db.commit()
    await db.refresh(restaurant)

    return LpRegisterAndInviteResponse(
        restaurant_id=restaurant.id,
        created=created,
        invite_url=_build_invite_url(new_token),
        access_code=new_code,
        expires_at=expires_at,
    )
