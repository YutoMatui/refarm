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
from app.models.enums import OrderStatus

router = APIRouter()

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
            "amount": int(row.total_quantity),
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
            "amount": int(row.total_quantity),
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
