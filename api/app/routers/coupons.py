"""
Consumer-facing Coupon Router - クーポン検証
"""
from datetime import datetime
from decimal import Decimal, ROUND_DOWN
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_consumer
from app.models import Consumer, Coupon
from app.models.coupon import DiscountType
from app.schemas.coupon import CouponValidateRequest, CouponValidateResponse

router = APIRouter()


def validate_coupon(coupon: Coupon | None, order_amount: Decimal) -> CouponValidateResponse:
    """クーポンを検証し、割引額を計算する"""
    if not coupon:
        return CouponValidateResponse(valid=False, code="", message="クーポンが見つかりません")

    if not coupon.is_active:
        return CouponValidateResponse(valid=False, code=coupon.code, message="このクーポンは無効です")

    now = datetime.now(tz=coupon.starts_at.tzinfo if coupon.starts_at else None)
    if coupon.starts_at and now < coupon.starts_at:
        return CouponValidateResponse(valid=False, code=coupon.code, message="このクーポンはまだ利用できません")

    if coupon.expires_at and now > coupon.expires_at:
        return CouponValidateResponse(valid=False, code=coupon.code, message="このクーポンは有効期限が切れています")

    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return CouponValidateResponse(valid=False, code=coupon.code, message="このクーポンは利用上限に達しています")

    if order_amount < coupon.min_order_amount:
        return CouponValidateResponse(
            valid=False, code=coupon.code,
            message=f"このクーポンは{int(coupon.min_order_amount):,}円以上の注文で利用できます"
        )

    if coupon.discount_type == DiscountType.PERCENTAGE:
        discount_amount = (order_amount * coupon.discount_value / Decimal(100)).quantize(Decimal("1"), rounding=ROUND_DOWN)
    else:
        discount_amount = min(coupon.discount_value, order_amount)

    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=coupon.discount_value,
        discount_amount=discount_amount,
        message="クーポンが適用されました",
    )


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon_code(
    request: CouponValidateRequest,
    _: Consumer = Depends(get_current_consumer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Coupon).where(Coupon.code == request.code.upper()))
    coupon = result.scalar_one_or_none()
    return validate_coupon(coupon, request.order_amount)
