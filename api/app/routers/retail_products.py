"""
Retail Products API Router - 消費者向け小売商品（公開API）
農家の商品（products）をもとに管理者が作成した小売商品を返す。
小売商品が未作成の農家商品はそのまま小売形式に変換して返す。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.retail_product import RetailProduct
from app.models.product import Product
from app.models.farmer import Farmer
from app.models.enums import HarvestStatus
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


def _product_to_retail_dict(product: Product) -> dict:
    """農家の商品をRetailProductResponse互換の辞書に変換する"""
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
    """消費者向け商品一覧を取得（小売商品 + 農家商品のフォールバック）"""

    # --- 1. 小売商品 (RetailProduct) を取得 ---
    rp_query = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(
            RetailProduct.deleted_at.is_(None),
            RetailProduct.is_active == 1,
        )
    )
    if category:
        rp_query = rp_query.where(RetailProduct.category == category)
    if is_featured is not None:
        rp_query = rp_query.where(RetailProduct.is_featured == is_featured)
    if is_wakeari is not None:
        rp_query = rp_query.where(RetailProduct.is_wakeari == is_wakeari)
    if search:
        rp_query = rp_query.where(RetailProduct.name.ilike(f"%{search}%"))

    rp_query = rp_query.order_by(RetailProduct.display_order.asc(), RetailProduct.id.asc())
    rp_result = await db.execute(rp_query)
    retail_products = rp_result.scalars().all()

    # 小売商品でカバー済みの source_product_id を収集
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
    if category:
        prod_query = prod_query.where(Product.category == category)
    if is_featured is not None:
        prod_query = prod_query.where(Product.is_featured == is_featured)
    if is_wakeari is not None:
        prod_query = prod_query.where(Product.is_wakeari == is_wakeari)
    if search:
        prod_query = prod_query.where(Product.name.ilike(f"%{search}%"))

    prod_query = prod_query.order_by(Product.id.asc())
    prod_result = await db.execute(prod_query)
    farmer_products = prod_result.scalars().all()

    # --- 3. 統合してレスポンスを組み立て ---
    items = []

    # 小売商品
    for rp in retail_products:
        data = RetailProductResponse.model_validate(rp).model_dump()
        data["source_product"] = _build_source_product_info(rp)
        items.append(data)

    # 農家商品（小売形式に変換）
    for prod in farmer_products:
        items.append(_product_to_retail_dict(prod))

    total = len(items)

    # ページネーション適用
    paginated = items[skip:skip + limit]

    return RetailProductListResponse(items=paginated, total=total, skip=skip, limit=limit)


@router.get("/{retail_product_id}", response_model=RetailProductResponse)
async def get_retail_product(retail_product_id: int, db: AsyncSession = Depends(get_db)):
    """消費者向け商品の詳細を取得（小売商品 or 農家商品）"""
    # まず小売商品を検索
    stmt = (
        select(RetailProduct)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(RetailProduct.id == retail_product_id, RetailProduct.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    rp = result.scalar_one_or_none()

    if rp:
        data = RetailProductResponse.model_validate(rp).model_dump()
        data["source_product"] = _build_source_product_info(rp)
        return data

    # 小売商品が見つからない場合、農家商品をフォールバック検索
    prod_stmt = (
        select(Product)
        .options(selectinload(Product.farmer))
        .where(Product.id == retail_product_id, Product.deleted_at.is_(None))
    )
    prod_result = await db.execute(prod_stmt)
    product = prod_result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    return _product_to_retail_dict(product)
