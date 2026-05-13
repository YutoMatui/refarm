"""
Retail Products API Router - 消費者向け小売商品（公開API）
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.retail_product import RetailProduct
from app.models.product import Product
from app.models.farmer import Farmer
from app.schemas.retail_product import RetailProductResponse, RetailProductListResponse

router = APIRouter()


def _build_source_product_info(retail_product):
    """RetailProductからsource_product情報を組み立てる"""
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


@router.get("/", response_model=RetailProductListResponse)
async def list_retail_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: str = Query(None, description="カテゴリで絞り込み"),
    is_featured: int = Query(None, description="おすすめ商品のみ"),
    is_wakeari: int = Query(None, description="訳あり商品のみ"),
    search: str = Query(None, description="商品名で検索"),
    db: AsyncSession = Depends(get_db)
):
    """消費者向け小売商品一覧を取得"""
    query = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(
            RetailProduct.deleted_at.is_(None),
            RetailProduct.is_active == 1,
        )
    )

    if category:
        query = query.where(RetailProduct.category == category)
    if is_featured is not None:
        query = query.where(RetailProduct.is_featured == is_featured)
    if is_wakeari is not None:
        query = query.where(RetailProduct.is_wakeari == is_wakeari)
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


@router.get("/{retail_product_id}", response_model=RetailProductResponse)
async def get_retail_product(retail_product_id: int, db: AsyncSession = Depends(get_db)):
    """消費者向け小売商品の詳細を取得"""
    stmt = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.id == retail_product_id, RetailProduct.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    rp = result.scalar_one_or_none()

    if not rp:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    data = RetailProductResponse.model_validate(rp).model_dump()
    data["source_product"] = _build_source_product_info(rp)
    return data
