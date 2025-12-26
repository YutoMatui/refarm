"""
Producer specific endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
import calendar

from app.core.database import get_db
from app.models import Order, OrderItem, Product, Farmer
from app.models.enums import OrderStatus, StockType
from app.schemas import ProductListResponse
from app.schemas.producer import (
    ProducerProductCreate,
    ProducerProductUpdate,
    ProducerProfileUpdate
)
from app.schemas.farmer import FarmerResponse

router = APIRouter()

@router.get("/products", response_model=ProductListResponse)
async def get_producer_products(
    farmer_id: int = Query(..., description="生産者ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者の出品商品一覧を取得
    """
    # Verify farmer exists
    stmt = select(Farmer).where(Farmer.id == farmer_id)
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Farmer not found")

    # Get products
    query = select(Product).where(Product.farmer_id == farmer_id)
    
    # Count total
    count_stmt = select(func.count(Product.id)).where(Product.farmer_id == farmer_id)
    total = await db.scalar(count_stmt)
    
    # Execute query
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.post("/products", response_model=dict)
async def create_producer_product(
    product_data: ProducerProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    生産者向け：商品新規登録
    """
    # Create product
    # Note: Setting default values for required fields not in the simplified schema
    new_product = Product(
        farmer_id=product_data.farmer_id,
        name=product_data.name,
        unit=product_data.unit,
        cost_price=product_data.cost_price,
        # Selling price = cost / 0.7 (approx 30% margin)
        price=int(product_data.cost_price / 0.7),
        harvest_status=product_data.harvest_status,
        image_url=product_data.image_url,
        description=product_data.description,
        is_wakeari=product_data.is_wakeari,
        stock_type=StockType.KOBE, # Default to KOBE
        is_active=1
    )
    
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    
    return {"id": new_product.id, "message": "Product created successfully"}


@router.put("/products/{product_id}", response_model=dict)
async def update_producer_product(
    product_id: int,
    product_data: ProducerProductUpdate,
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者向け：商品更新
    """
    stmt = select(Product).where(
        Product.id == product_id,
        Product.farmer_id == farmer_id
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    update_dict = product_data.model_dump(exclude_unset=True)
    
    # Recalculate price if cost_price changed
    if "cost_price" in update_dict:
        update_dict["price"] = int(update_dict["cost_price"] / 0.7)
        
    for key, value in update_dict.items():
        setattr(product, key, value)
        
    await db.commit()
    
    return {"id": product.id, "message": "Product updated successfully"}


@router.get("/profile", response_model=FarmerResponse)
async def get_producer_profile(
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者プロフィール取得
    """
    stmt = select(Farmer).where(Farmer.id == farmer_id)
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
        
    return farmer


@router.put("/profile", response_model=dict)
async def update_producer_profile(
    profile_data: ProducerProfileUpdate,
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者プロフィール更新
    """
    stmt = select(Farmer).where(Farmer.id == farmer_id)
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
        
    update_dict = profile_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(farmer, key, value)
        
    await db.commit()
    
    return {"id": farmer.id, "message": "Profile updated successfully"}


@router.get("/dashboard/schedule", response_model=list[dict])
async def get_producer_schedule(
    farmer_id: int = Query(..., description="生産者ID"),
    date: str = Query(..., description="対象日 (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者向けスケジュール取得
    指定日の「出荷」と「準備」のタスクを返す
    """
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # 1. Shipping Tasks (Orders with delivery_date = target_date)
    # Assuming shipping happens on the same day as delivery for simplicity, or 1 day before.
    # The prompt implies "Screen to know when and how much vegetables to prepare".
    # Usually, if delivery is on Day X, shipping is Day X (morning) or Day X-1.
    # Let's assume Delivery Date is the key date for "Shipping".
    
    shipping_stmt = (
        select(
            Product.name,
            Product.unit,
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .join(OrderItem, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) == target_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(Product.name, Product.unit)
    )
    
    shipping_result = await db.execute(shipping_stmt)
    shipping_tasks = [
        {
            "id": f"ship_{i}",
            "name": row.name,
            "amount": int(row.total_quantity or 0),
            "unit": row.unit,
            "type": "shipping"
        }
        for i, row in enumerate(shipping_result.all())
    ]

    # 2. Preparation Tasks (Orders with delivery_date = target_date + 1)
    # Prepare for tomorrow's delivery
    next_day = target_date + timedelta(days=1)
    prep_stmt = (
        select(
            Product.name,
            Product.unit,
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .join(OrderItem, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) == next_day,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(Product.name, Product.unit)
    )

    prep_result = await db.execute(prep_stmt)
    prep_tasks = [
        {
            "id": f"prep_{i}",
            "name": row.name,
            "amount": int(row.total_quantity or 0),
            "unit": row.unit,
            "type": "preparation"
        }
        for i, row in enumerate(prep_result.all())
    ]

    return shipping_tasks + prep_tasks


@router.get("/dashboard/sales", response_model=dict)
async def get_producer_sales(
    farmer_id: int = Query(..., description="生産者ID"),
    month: str = Query(..., description="対象月 (YYYY-MM)"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者向け売上ダッシュボードデータ取得
    """
    try:
        year_str, month_str = month.split('-')
        year = int(year_str)
        month_num = int(month_str)
        
        start_date = datetime(year, month_num, 1).date()
        _, last_day = calendar.monthrange(year, month_num)
        end_date = datetime(year, month_num, last_day).date()
        
        # Previous Month for comparison
        prev_month_date = start_date - timedelta(days=1)
        prev_start = datetime(prev_month_date.year, prev_month_date.month, 1).date()
        _, prev_last = calendar.monthrange(prev_month_date.year, prev_month_date.month)
        prev_end = datetime(prev_month_date.year, prev_month_date.month, prev_last).date()
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # 1. Total Sales & Orders (Current Month)
    # Using OrderItem.total_amount for sales.
    # Note: OrderItem.total_amount is tax included.
    # If we need cost_price (profit), we should use product.cost_price * quantity.
    # The prompt asked for "Sales", usually meaning Gross Sales.
    # Let's use total_amount for now.
    
    sales_stmt = (
        select(
            func.sum(OrderItem.total_amount).label("total_sales"),
            func.count(func.distinct(Order.id)).label("total_orders")
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
    )
    
    result = await db.execute(sales_stmt)
    current_stats = result.one()
    total_sales = int(current_stats.total_sales or 0)
    total_orders = int(current_stats.total_orders or 0)
    
    # 2. Previous Month Sales
    prev_sales_stmt = (
        select(func.sum(OrderItem.total_amount).label("total_sales"))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) >= prev_start,
            func.date(Order.delivery_date) <= prev_end,
            Order.status != OrderStatus.CANCELLED
        )
    )
    prev_result = await db.execute(prev_sales_stmt)
    prev_sales = int(prev_result.scalar() or 0)

    # 3. Daily Sales (Graph)
    daily_stmt = (
        select(
            func.date(Order.delivery_date).label("date"),
            func.sum(OrderItem.total_amount).label("amount")
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(func.date(Order.delivery_date))
        .order_by(func.date(Order.delivery_date))
    )
    
    daily_result = await db.execute(daily_stmt)
    daily_sales = [
        {"day": row.date.day, "amount": int(row.amount)}
        for row in daily_result.all()
    ]
    
    # Fill in missing days with 0
    daily_map = {d["day"]: d["amount"] for d in daily_sales}
    full_daily_sales = []
    for d in range(1, last_day + 1):
        full_daily_sales.append({
            "day": d,
            "amount": daily_map.get(d, 0)
        })

    # 4. Product Ranking
    ranking_stmt = (
        select(
            Product.name,
            func.sum(OrderItem.total_amount).label("amount"),
            func.sum(OrderItem.quantity).label("count")
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(Product.name)
        .order_by(func.sum(OrderItem.total_amount).desc())
        .limit(5)
    )
    
    ranking_result = await db.execute(ranking_stmt)
    top_products = [
        {"name": row.name, "amount": int(row.amount), "count": int(row.count)}
        for row in ranking_result.all()
    ]

    return {
        "totalSales": total_sales,
        "lastMonthSales": prev_sales,
        "totalOrders": total_orders,
        "avgOrderPrice": int(total_sales / total_orders) if total_orders > 0 else 0,
        "dailySales": full_daily_sales,
        "topProducts": top_products
    }
