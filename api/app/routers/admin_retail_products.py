"""
Admin Retail Products API Router - 消費者向け小売商品の管理
"""
from datetime import datetime
from decimal import Decimal, ROUND_UP
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.routers.admin_auth import get_current_admin
from app.models.retail_product import RetailProduct
from app.models.product import Product
from app.models.farmer import Farmer
from app.models.enums import HarvestStatus
from app.schemas.retail_product import (
    RetailProductCreate,
    RetailProductUpdate,
    RetailProductResponse,
    RetailProductListResponse,
    SuggestPriceRequest,
    SuggestPriceResponse,
)
from app.schemas.base import ResponseMessage

router = APIRouter()


def _build_source_product_info(retail_product):
    sp = retail_product.source_product
    if not sp:
        return None
    return {
        "id": sp.id,
        "name": sp.name,
        "unit": sp.unit,
        "cost_price": sp.cost_price,
        "farmer_id": sp.farmer_id,
        "farmer_name": sp.farmer.name if sp.farmer else None,
    }


@router.get("/retail-products", response_model=RetailProductListResponse)
async def list_retail_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    is_active: int = Query(None),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売商品一覧"""
    query = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.deleted_at.is_(None))
    )
    if is_active is not None:
        query = query.where(RetailProduct.is_active == is_active)
    if search:
        query = query.where(RetailProduct.name.ilike(f"%{search}%"))

    query = query.order_by(RetailProduct.display_order.asc(), RetailProduct.id.asc())

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    items = []
    for rp in products:
        data = RetailProductResponse.model_validate(rp).model_dump()
        data["source_product"] = _build_source_product_info(rp)
        items.append(data)

    return RetailProductListResponse(items=items, total=total or 0, skip=skip, limit=limit)


@router.post("/retail-products", response_model=RetailProductResponse, status_code=status.HTTP_201_CREATED)
async def create_retail_product(
    data: RetailProductCreate,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売商品を作成"""
    # source_product の存在確認
    stmt = select(Product).where(Product.id == data.source_product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="指定された農家商品が見つかりません")

    rp = RetailProduct(**data.model_dump())
    db.add(rp)
    await db.commit()

    # Re-fetch with relationships
    stmt = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.id == rp.id)
    )
    result = await db.execute(stmt)
    rp = result.scalar_one()

    resp = RetailProductResponse.model_validate(rp).model_dump()
    resp["source_product"] = _build_source_product_info(rp)
    return resp


@router.put("/retail-products/{retail_product_id}", response_model=RetailProductResponse)
async def update_retail_product(
    retail_product_id: int,
    data: RetailProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売商品を更新"""
    stmt = select(RetailProduct).where(RetailProduct.id == retail_product_id, RetailProduct.deleted_at.is_(None))
    result = await db.execute(stmt)
    rp = result.scalar_one_or_none()
    if not rp:
        raise HTTPException(status_code=404, detail="小売商品が見つかりません")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rp, field, value)

    await db.commit()

    stmt = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.id == rp.id)
    )
    result = await db.execute(stmt)
    rp = result.scalar_one()

    resp = RetailProductResponse.model_validate(rp).model_dump()
    resp["source_product"] = _build_source_product_info(rp)
    return resp


@router.delete("/retail-products/{retail_product_id}", response_model=ResponseMessage)
async def delete_retail_product(
    retail_product_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売商品を削除（ソフトデリート）"""
    stmt = select(RetailProduct).where(RetailProduct.id == retail_product_id, RetailProduct.deleted_at.is_(None))
    result = await db.execute(stmt)
    rp = result.scalar_one_or_none()
    if not rp:
        raise HTTPException(status_code=404, detail="小売商品が見つかりません")

    rp.deleted_at = datetime.now()
    await db.commit()
    return ResponseMessage(message="小売商品を削除しました", success=True)


@router.post("/retail-products/suggest-price", response_model=SuggestPriceResponse)
async def suggest_retail_price(
    data: SuggestPriceRequest,
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売価格の推奨計算"""
    cost = Decimal(str(data.cost_price))
    factor = Decimal(str(data.conversion_factor))
    margin = Decimal(str(data.waste_margin_pct))
    multiplier = Decimal(str(data.price_multiplier))

    if factor <= 0 or multiplier <= 0:
        raise HTTPException(status_code=400, detail="変換係数とマージン係数は0より大きい必要があります")

    cost_per_unit = cost / factor
    with_margin = cost_per_unit / (Decimal("1") - margin / Decimal("100"))
    suggested = (with_margin / multiplier).quantize(Decimal("1"), rounding=ROUND_UP)

    breakdown = (
        f"仕入値 ¥{cost} ÷ {factor} = ¥{cost_per_unit:.0f}/小売単位 → "
        f"廃棄{margin}%込み ¥{with_margin:.0f} → "
        f"マージン{multiplier}で ¥{suggested}"
    )

    return SuggestPriceResponse(
        suggested_price=suggested,
        cost_per_retail_unit=cost_per_unit.quantize(Decimal("1")),
        breakdown=breakdown,
    )
