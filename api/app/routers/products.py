"""
Product API Router - 商品管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_line_user_id
from app.models import Product, Order, OrderItem, Restaurant
from app.models.enums import StockType, ProductCategory
from app.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductFilterParams,
    ResponseMessage,
)

router = APIRouter()


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(product_data: ProductCreate, db: AsyncSession = Depends(get_db)):
    """商品を新規登録"""
    db_product = Product(**product_data.model_dump())
    db.add(db_product)
    await db.commit()
    
    # Re-fetch with farmer loaded
    stmt = select(Product).options(selectinload(Product.farmer)).where(Product.id == db_product.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/", response_model=ProductListResponse)
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    stock_type: StockType = Query(None, description="種別で絞り込み"),
    category: ProductCategory = Query(None, description="カテゴリで絞り込み"),
    farmer_id: int = Query(None, description="生産者IDで絞り込み"),
    is_active: int = Query(None, description="販売状態で絞り込み"),
    is_featured: int = Query(None, description="おすすめ商品のみ"),
    is_wakeari: int = Query(None, description="訳あり商品のみ"),
    search: str = Query(None, description="商品名で検索"),
    db: AsyncSession = Depends(get_db)
):
    """商品一覧を取得（カタログ用）"""
    query = select(Product).options(selectinload(Product.farmer)).where(Product.deleted_at.is_(None))
    
    if stock_type:
        query = query.where(Product.stock_type == stock_type)
    if category:
        query = query.where(Product.category == category)
    if farmer_id:
        query = query.where(Product.farmer_id == farmer_id)
    if is_active is not None:
        query = query.where(Product.is_active == is_active)
    if is_featured is not None:
        query = query.where(Product.is_featured == is_featured)
    if is_wakeari is not None:
        query = query.where(Product.is_wakeari == is_wakeari)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    
    # Order by display_order and id
    query = query.order_by(Product.display_order.asc(), Product.id.asc())
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.get("/purchased", response_model=ProductListResponse)
async def list_purchased_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: str = Query(None, description="商品名で検索"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """過去に購入した商品一覧を取得（リピート用）"""
    # まず飲食店IDを取得
    stmt = select(Restaurant.id).where(Restaurant.line_user_id == line_user_id)
    restaurant_id = await db.scalar(stmt)
    
    if not restaurant_id:
        return ProductListResponse(items=[], total=0, skip=skip, limit=limit)

    # 購入履歴から商品情報を取得
    query = select(Product).options(selectinload(Product.farmer))\
        .join(OrderItem, OrderItem.product_id == Product.id)\
        .join(Order, Order.id == OrderItem.order_id)\
        .where(Order.restaurant_id == restaurant_id)\
        .distinct()
        
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
        
    # Total count
    count_query = select(func.count(func.distinct(Product.id))).join(OrderItem, OrderItem.product_id == Product.id)\
        .join(Order, Order.id == OrderItem.order_id)\
        .where(Order.restaurant_id == restaurant_id)
        
    if search:
        count_query = count_query.where(Product.name.ilike(f"%{search}%"))
        
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """商品詳細を取得"""
    stmt = select(Product).options(selectinload(Product.farmer)).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """商品情報を更新"""
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    
    # Re-fetch with farmer loaded
    stmt = select(Product).options(selectinload(Product.farmer)).where(Product.id == product.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{product_id}", response_model=ResponseMessage)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """商品を削除（ソフトデリート）"""
    from datetime import datetime
    
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    product.deleted_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(message="商品を削除しました", success=True)
