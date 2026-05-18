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

router = APIRouter()


def _product_to_retail_dict(product: Product) -> dict:
    """農家の商品をRetailProductResponse互換の辞書に変換する"""
    tax_rate_value = product.tax_rate.value if hasattr(product.tax_rate, 'value') else int(product.tax_rate)
    farmer = product.farmer
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
        "image_urls": [product.image_url] if product.image_url else [],
        "category": product.category.value if product.category and hasattr(product.category, 'value') else product.category,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_wakeari": product.is_wakeari,
        "display_order": product.display_order if product.display_order is not None else 0,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "farming_method": product.farming_method,
        "weight": product.weight,
        "stock_quantity": product.stock_quantity,
        "info_confirmed_at": farmer.info_confirmed_at.isoformat() if farmer and farmer.info_confirmed_at else None,
        "source_product": {
            "id": product.id,
            "name": product.name,
            "unit": product.unit,
            "cost_price": product.cost_price,
            "farmer_id": product.farmer_id,
            "farmer_name": farmer.name if farmer else None,
        },
    }


@router.get("/")
async def list_consumer_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: str = Query(None, description="カテゴリで絞り込み"),
    is_featured: int = Query(None, description="おすすめ商品のみ"),
    is_wakeari: int = Query(None, description="訳あり商品のみ"),
    search: str = Query(None, description="商品名で検索"),
    db: AsyncSession = Depends(get_db)
):
    """消費者向け商品一覧（小売商品 + 農家商品のフォールバック）"""

    # --- 1. 小売商品 (RetailProduct) を取得 ---
    rp_query = (
        select(RetailProduct)
        .join(RetailProduct.source_product)
        .join(Product.farmer)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(
            RetailProduct.deleted_at.is_(None),
            RetailProduct.is_active == 1,
            Product.deleted_at.is_(None),
            Farmer.is_active == 1,
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

    covered_product_ids = {rp.source_product_id for rp in retail_products}

    # --- 2. 小売商品でカバーされていない農家商品 (Product) を取得 ---
    prod_query = (
        select(Product)
        .join(Product.farmer)
        .options(selectinload(Product.farmer))
        .where(
            Product.deleted_at.is_(None),
            Product.is_active == 1,
            Product.harvest_status != HarvestStatus.ENDED.value,
            Farmer.is_active == 1,
            Farmer.deleted_at.is_(None),
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

    # --- 3. 統合 ---
    items = []
    for rp in retail_products:
        sp = rp.source_product
        farmer = sp.farmer if sp else None
        data = {
            "id": rp.id,
            "source_product_id": rp.source_product_id,
            "name": rp.name,
            "description": rp.description,
            "retail_price": str(rp.retail_price),
            "tax_rate": rp.tax_rate,
            "retail_unit": rp.retail_unit,
            "retail_quantity_label": rp.retail_quantity_label,
            "conversion_factor": str(rp.conversion_factor),
            "waste_margin_pct": rp.waste_margin_pct,
            "image_url": rp.image_url,
            "image_urls": rp.image_urls or ([rp.image_url] if rp.image_url else []),
            "category": rp.category,
            "is_active": rp.is_active,
            "is_featured": rp.is_featured,
            "is_wakeari": rp.is_wakeari,
            "display_order": rp.display_order,
            "created_at": rp.created_at,
            "updated_at": rp.updated_at,
            "farming_method": sp.farming_method if sp else None,
            "weight": sp.weight if sp else None,
            "stock_quantity": sp.stock_quantity if sp else None,
            "info_confirmed_at": farmer.info_confirmed_at.isoformat() if farmer and farmer.info_confirmed_at else None,
            "source_product": {
                "id": sp.id,
                "name": sp.name,
                "unit": sp.unit,
                "cost_price": sp.cost_price,
                "farmer_id": sp.farmer_id,
                "farmer_name": farmer.name if farmer else None,
            } if sp else None,
        }
        items.append(data)

    for prod in farmer_products:
        items.append(_product_to_retail_dict(prod))

    total = len(items)
    paginated = items[skip:skip + limit]

    return {"items": paginated, "total": total, "skip": skip, "limit": limit}


@router.get("/{product_id}")
async def get_consumer_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """消費者向け商品の詳細（小売商品 or 農家商品）"""
    # まず小売商品を検索（非表示農家の商品は除外）
    stmt = (
        select(RetailProduct)
        .join(RetailProduct.source_product)
        .join(Product.farmer)
        .options(selectinload(RetailProduct.source_product).selectinload(Product.farmer))
        .where(
            RetailProduct.id == product_id,
            RetailProduct.deleted_at.is_(None),
            Farmer.is_active == 1,
        )
    )
    result = await db.execute(stmt)
    rp = result.scalar_one_or_none()

    if rp:
        sp = rp.source_product
        farmer = sp.farmer if sp else None
        return {
            "id": rp.id,
            "source_product_id": rp.source_product_id,
            "name": rp.name,
            "description": rp.description,
            "retail_price": str(rp.retail_price),
            "tax_rate": rp.tax_rate,
            "retail_unit": rp.retail_unit,
            "retail_quantity_label": rp.retail_quantity_label,
            "conversion_factor": str(rp.conversion_factor),
            "waste_margin_pct": rp.waste_margin_pct,
            "image_url": rp.image_url,
            "image_urls": rp.image_urls or ([rp.image_url] if rp.image_url else []),
            "category": rp.category,
            "is_active": rp.is_active,
            "is_featured": rp.is_featured,
            "is_wakeari": rp.is_wakeari,
            "display_order": rp.display_order,
            "created_at": rp.created_at,
            "updated_at": rp.updated_at,
            "farming_method": sp.farming_method if sp else None,
            "weight": sp.weight if sp else None,
            "stock_quantity": sp.stock_quantity if sp else None,
            "info_confirmed_at": farmer.info_confirmed_at.isoformat() if farmer and farmer.info_confirmed_at else None,
            "source_product": {
                "id": sp.id,
                "name": sp.name,
                "unit": sp.unit,
                "cost_price": sp.cost_price,
                "farmer_id": sp.farmer_id,
                "farmer_name": farmer.name if farmer else None,
            } if sp else None,
        }

    # 農家商品をフォールバック検索（非表示農家の商品は除外）
    prod_stmt = (
        select(Product)
        .join(Product.farmer)
        .options(selectinload(Product.farmer))
        .where(
            Product.id == product_id,
            Product.deleted_at.is_(None),
            Farmer.is_active == 1,
        )
    )
    prod_result = await db.execute(prod_stmt)
    product = prod_result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")

    return _product_to_retail_dict(product)
