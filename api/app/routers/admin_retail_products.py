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


def _product_to_retail_dict(product: Product) -> dict:
    """農家の商品をRetailProductResponse互換の辞書に変換する（管理画面用）"""
    tax_rate_value = product.tax_rate.value if hasattr(product.tax_rate, 'value') else int(product.tax_rate)
    return {
        "id": product.id,
        "source_product_id": product.id,
        "name": product.name,
        "description": product.description,
        "retail_price": product.price,
        "tax_rate": tax_rate_value,
        "retail_unit": product.unit or "個",
        "retail_quantity_label": None,
        "conversion_factor": 1.0,
        "waste_margin_pct": 0,
        "image_url": product.image_url,
        "category": product.category.value if product.category and hasattr(product.category, 'value') else product.category,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_wakeari": product.is_wakeari,
        "display_order": product.display_order if product.display_order is not None else 0,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "source_product": {
            "id": product.id,
            "name": product.name,
            "unit": product.unit,
            "cost_price": product.cost_price,
            "farmer_id": product.farmer_id,
            "farmer_name": product.farmer.name if product.farmer else None,
        },
        "_is_farmer_product": True,
    }


@router.get("/retail-products", response_model=RetailProductListResponse)
async def list_retail_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: int = Query(None),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """管理者用: 小売商品一覧（小売商品 + 農家商品のフォールバック）"""

    # --- 1. 小売商品 (RetailProduct) を取得 ---
    rp_query = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.deleted_at.is_(None))
    )
    if is_active is not None:
        rp_query = rp_query.where(RetailProduct.is_active == is_active)
    if search:
        rp_query = rp_query.where(RetailProduct.name.ilike(f"%{search}%"))

    rp_query = rp_query.order_by(RetailProduct.display_order.asc(), RetailProduct.id.asc())
    rp_result = await db.execute(rp_query)
    retail_products = rp_result.scalars().all()

    covered_product_ids = {rp.source_product_id for rp in retail_products}

    # --- 2. 小売商品でカバーされていない農家商品 (Product) を取得 ---
    prod_query = (
        select(Product)
        .options(selectinload(Product.farmer))
        .where(
            Product.deleted_at.is_(None),
            Product.is_active == 1,
            Product.harvest_status != HarvestStatus.ENDED.value,
        )
    )
    if covered_product_ids:
        prod_query = prod_query.where(Product.id.notin_(covered_product_ids))
    if search:
        prod_query = prod_query.where(Product.name.ilike(f"%{search}%"))

    prod_query = prod_query.order_by(Product.id.asc())
    prod_result = await db.execute(prod_query)
    farmer_products = prod_result.scalars().all()

    # --- 3. 統合してレスポンス ---
    items = []
    for rp in retail_products:
        data = RetailProductResponse.model_validate(rp).model_dump()
        data["source_product"] = _build_source_product_info(rp)
        items.append(data)

    for prod in farmer_products:
        items.append(_product_to_retail_dict(prod))

    total = len(items)
    paginated = items[skip:skip + limit]

    return RetailProductListResponse(items=paginated, total=total, skip=skip, limit=limit)


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
