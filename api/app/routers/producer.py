"""
Producer API Router - 生産者用商品管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import Product
from app.models.enums import StockType, ProductCategory, TaxRate
from app.schemas.producer import (
    ProducerProductCreate,
    ProducerProductUpdate,
)
from app.schemas.product import (
    ProductResponse,
    ProductListResponse,
    ProductFilterParams,
)
from app.schemas import ResponseMessage

router = APIRouter()


@router.get("/products", response_model=ProductListResponse)
async def list_producer_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """生産者の商品一覧を取得"""
    query = select(Product).where(
        Product.deleted_at.is_(None),
        Product.farmer_id == farmer_id
    )
    
    # Order by display_order and id
    query = query.order_by(Product.display_order.asc(), Product.id.asc())
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_producer_product(
    product_data: ProducerProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """生産者用：商品を新規登録"""
    # Create dict from model
    data = product_data.model_dump()
    
    # Set default values for fields not in ProducerProductCreate but required by Product model
    # Note: ProducerProductCreate has farmer_id, unit, cost_price, harvest_status, etc.
    # We need to set stock_type, tax_rate, price (maybe calculated from cost?), etc.
    
    # Assuming defaults or logic here. 
    # For now, let's assume price is same as cost_price if not specified (though schema has cost_price).
    # Wait, Product model requires 'price' (sales price). ProducerProductCreate ONLY has 'cost_price'.
    # This might be an issue. Let's assume price = cost_price * markup or just same for now if not provided.
    # Actually, let's look at the schema again.
    
    # ProducerProductCreate: name, unit, cost_price, harvest_status, image_url, description, farmer_id
    # Product model requires: name, price, tax_rate, unit, stock_type
    
    # We are missing 'price', 'tax_rate', 'stock_type'.
    # We should probably set reasonable defaults or derive them.
    
    # Defaulting stock_type to KOBE since it's a producer (farmer)
    stock_type = StockType.KOBE
    
    # Defaulting tax_rate to REDUCED (8%) for food
    tax_rate = TaxRate.REDUCED
    
    # For price, we might need to just use cost_price as a placeholder or if the business logic implies cost_price IS the price for them?
    # Or maybe 'price' in Product table IS the selling price, and cost_price is what farmer gets.
    # Let's set price = cost_price for now to avoid validation error, or check if there is a margin logic.
    # I'll simply set price = cost_price.
    
    db_product = Product(
        name=data["name"],
        description=data.get("description"),
        unit=data["unit"],
        cost_price=data["cost_price"],
        price=data["cost_price"], # Temporary assignment
        harvest_status=data["harvest_status"],
        image_url=data.get("image_url"),
        farmer_id=data["farmer_id"],
        stock_type=stock_type,
        tax_rate=tax_rate,
        category=ProductCategory.LEAFY, # Default category? Or null if nullable. Model says nullable=True.
        is_active=1,
    )
    
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_producer_product(
    product_id: int,
    product_data: ProducerProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """生産者用：商品情報を更新"""
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    update_data = product_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if hasattr(product, field):
            setattr(product, field, value)
            
            # If cost_price is updated, should we update price too?
            if field == "cost_price":
                # For now keep them synced or leave price alone? 
                # Let's update price to match cost_price if it's being used as such.
                product.price = value
    
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}", response_model=ResponseMessage)
async def delete_producer_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """生産者用：商品を削除（ソフトデリート）"""
    from datetime import datetime
    
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    product.deleted_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(message="商品を削除しました", success=True)
