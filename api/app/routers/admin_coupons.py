"""
Admin Coupon Management Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.routers.admin_auth import require_super_admin
from app.models import Admin, Coupon
from app.schemas.coupon import CouponCreate, CouponUpdate, CouponResponse, CouponListResponse

router = APIRouter()


@router.get("/coupons/", response_model=CouponListResponse)
async def list_coupons(
    skip: int = 0,
    limit: int = 100,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Coupon).order_by(desc(Coupon.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    count_result = await db.execute(select(func.count(Coupon.id)))
    total = count_result.scalar() or 0

    return CouponListResponse(items=items, total=total)


@router.post("/coupons/", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    coupon_data: CouponCreate,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Coupon).where(Coupon.code == coupon_data.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このクーポンコードは既に存在します")

    coupon = Coupon(
        code=coupon_data.code.upper(),
        description=coupon_data.description,
        discount_type=coupon_data.discount_type.value,
        discount_value=coupon_data.discount_value,
        min_order_amount=coupon_data.min_order_amount,
        max_uses=coupon_data.max_uses,
        is_active=coupon_data.is_active,
        starts_at=coupon_data.starts_at,
        expires_at=coupon_data.expires_at,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.put("/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: int,
    update_data: CouponUpdate,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="クーポンが見つかりません")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(coupon, field, value)

    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coupon(
    coupon_id: int,
    _: Admin = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="クーポンが見つかりません")

    await db.delete(coupon)
    await db.commit()
