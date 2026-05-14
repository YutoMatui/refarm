"""
Retail Products API Router - 消費者向け商品（公開API）
管理者が is_consumer_visible フラグを立てた農家商品を消費者に表示する。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.product import Product
from app.models.farmer import Farmer
from app.models.enums import HarvestStatus
from app.schemas.retail_product import RetailProductListResponse

router = APIRouter()


def _product_to_retail_dict(product: Product) -> dict:
    """農家の商品をRetailProductResponse互換の辞書に変換する"""
    tax_rate_value = product.tax_rate.value if hasattr(product.tax_rate, 'value') else int(product.tax_rate)
    return {
        "id": product.id,
        "source_product_id": product.id,
        "name": product.name,
        "description": product.description,
        "retail_price": str(product.price),
        "tax_rate": tax_rate_value,
        "retail_unit": product.unit or "個",
        "retail_quantity_label": None,
        "conversion_factor": "1",
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
    }


@router.get("/")
async def list_consumer_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: str = Query(None, description="カテゴリで絞り込み"),
    is_featured: int = Query(None, description="おすすめ商品のみ"),
    is_wakeari: int = Query(None, description="訳あり商品のみ"),
    search: str = Query(None, description="商品名で検索"),
    db: AsyncSession = Depends(get_db)
):
    """消費者向け商品一覧（is_consumer_visible=1 の農家商品）"""
    query = (
        select(Product)
        .options(selectinload(Product.farmer))
        .where(
            Product.deleted_at.is_(None),
            Product.is_active == 1,
            Product.is_consumer_visible == 1,
            Product.harvest_status != HarvestStatus.ENDED.value,
        )
    )

    if category:
        query = query.where(Product.category == category)
    if is_featured is not None:
        query = query.where(Product.is_featured == is_featured)
    if is_wakeari is not None:
        query = query.where(Product.is_wakeari == is_wakeari)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))

    query = query.order_by(Product.display_order.asc(), Product.id.asc())

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    items = [_product_to_retail_dict(p) for p in products]

    return {"items": items, "total": total or 0, "skip": skip, "limit": limit}


@router.get("/{product_id}")
async def get_consumer_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """消費者向け商品の詳細"""
    stmt = (
        select(Product)
        .options(selectinload(Product.farmer))
        .where(
            Product.id == product_id,
            Product.deleted_at.is_(None),
            Product.is_consumer_visible == 1,
        )
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    return _product_to_retail_dict(product)
