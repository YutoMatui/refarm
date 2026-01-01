"""
Farmer API Router - 生産者管理
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, desc, and_, or_
from sqlalchemy.orm import selectinload
import secrets
import os
from datetime import datetime, timedelta
import calendar

from app.core.database import get_db
from app.models import Farmer, Product, Order, OrderItem
from app.models.enums import OrderStatus
from app.services.route_service import route_service
from app.schemas import (
    FarmerCreate,
    FarmerUpdate,
    FarmerResponse,
    FarmerListResponse,
    ResponseMessage,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)

router = APIRouter()


@router.get("/dashboard/schedule")
async def get_producer_schedule(
    farmer_id: int = Query(..., description="生産者ID"),
    date: str = Query(..., description="日付 (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者のスケジュール（出荷・準備）を取得
    """
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    schedule_items = []

    # 1. Shipping Tasks (Orders delivering on target_date)
    # 配送日が target_date の注文明細を取得
    shipping_query = (
        select(
            Product.name,
            Product.unit,
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) == target_date,
            Order.status != OrderStatus.CANCELLED,
            Order.status != OrderStatus.DELIVERED  # 完了したものは表示しない？一旦表示する方針で
        )
        .group_by(Product.id, Product.name, Product.unit)
    )
    
    shipping_result = await db.execute(shipping_query)
    for row in shipping_result:
        schedule_items.append({
            "id": f"shipping-{row.name}",
            "name": row.name,
            "amount": float(row.total_quantity),
            "unit": row.unit,
            "type": "shipping"
        })

    # 2. Preparation Tasks (Orders delivering on target_date + 1)
    # 配送日が翌日の注文明細を取得（前日準備）
    next_day = target_date + timedelta(days=1)
    prep_query = (
        select(
            Product.name,
            Product.unit,
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            func.date(Order.delivery_date) == next_day,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(Product.id, Product.name, Product.unit)
    )
    
    prep_result = await db.execute(prep_query)
    for row in prep_result:
        schedule_items.append({
            "id": f"prep-{row.name}",
            "name": row.name,
            "amount": float(row.total_quantity),
            "unit": row.unit,
            "type": "preparation"
        })

    return schedule_items


@router.get("/dashboard/sales")
async def get_producer_sales(
    farmer_id: int = Query(..., description="生産者ID"),
    month: str = Query(..., description="月 (YYYY-MM)"),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者の売上データを取得
    """
    try:
        target_month = datetime.strptime(month, "%Y-%m")
        # Start and end of month
        start_date = target_month.replace(day=1)
        _, last_day = calendar.monthrange(start_date.year, start_date.month)
        end_date = start_date.replace(day=last_day, hour=23, minute=59, second=59)
        
        # Previous month for comparison
        prev_month_start = (start_date - timedelta(days=1)).replace(day=1)
        _, prev_last_day = calendar.monthrange(prev_month_start.year, prev_month_start.month)
        prev_month_end = prev_month_start.replace(day=prev_last_day, hour=23, minute=59, second=59)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Helper function to get sales for a period
    async def get_period_sales(start, end):
        query = (
            select(
                func.sum(OrderItem.total_amount).label("total_sales"),
                func.count(func.distinct(Order.id)).label("order_count")
            )
            .join(OrderItem.order)
            .join(OrderItem.product)
            .where(
                Product.farmer_id == farmer_id,
                Order.delivery_date >= start,
                Order.delivery_date <= end,
                Order.status != OrderStatus.CANCELLED
            )
        )
        result = await db.execute(query)
        row = result.one()
        return float(row.total_sales or 0), int(row.order_count or 0)

    # Current month sales
    total_sales, total_orders = await get_period_sales(start_date, end_date)
    
    # Last month sales
    last_month_sales, _ = await get_period_sales(prev_month_start, prev_month_end)
    
    # Average order price
    avg_order_price = total_sales / total_orders if total_orders > 0 else 0

    # Daily sales
    daily_query = (
        select(
            func.extract('day', Order.delivery_date).label("day"),
            func.sum(OrderItem.total_amount).label("daily_total")
        )
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            Order.delivery_date >= start_date,
            Order.delivery_date <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(func.extract('day', Order.delivery_date))
    )
    daily_result = await db.execute(daily_query)
    daily_sales = [{"day": int(row.day), "amount": float(row.daily_total)} for row in daily_result]

    # Top products
    product_query = (
        select(
            Product.name,
            func.sum(OrderItem.total_amount).label("product_sales"),
            func.sum(OrderItem.quantity).label("product_count")
        )
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            Order.delivery_date >= start_date,
            Order.delivery_date <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(Product.id, Product.name)
        .order_by(desc("product_sales"))
        .limit(5)
    )
    product_result = await db.execute(product_query)
    top_products = [
        {
            "name": row.name, 
            "amount": float(row.product_sales), 
            "count": float(row.product_count)
        } 
        for row in product_result
    ]

    return {
        "totalSales": total_sales,
        "lastMonthSales": last_month_sales,
        "totalOrders": total_orders,
        "avgOrderPrice": avg_order_price,
        "dailySales": daily_sales,
        "topProducts": top_products
    }


@router.get("/products", response_model=ProductListResponse)
async def list_producer_products(
    farmer_id: int = Query(..., description="生産者ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """生産者の商品一覧を取得"""
    query = select(Product).where(
        Product.farmer_id == farmer_id,
        Product.deleted_at.is_(None)
    )
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    
    return ProductListResponse(items=products, total=total or 0, skip=skip, limit=limit)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_producer_product(
    product_data: ProductCreate, 
    db: AsyncSession = Depends(get_db)
):
    """商品を新規登録"""
    db_product = Product(**product_data.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_producer_product(
    product_id: int,
    product_data: ProductUpdate,
    farmer_id: int = Query(..., description="生産者ID"),
    db: AsyncSession = Depends(get_db)
):
    """商品情報を更新"""
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    # Simple ownership check
    if product.farmer_id != farmer_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この商品を編集する権限がありません")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    return product



@router.post("/", response_model=FarmerResponse, status_code=status.HTTP_201_CREATED)
async def create_farmer(farmer_data: FarmerCreate, db: AsyncSession = Depends(get_db)):
    """生産者を新規登録"""
    # Auto-geocode if address is provided
    if farmer_data.address:
        coords = await route_service.get_coordinates(farmer_data.address)
        if coords:
            farmer_data.latitude = str(coords["lat"])
            farmer_data.longitude = str(coords["lng"])
            
    db_farmer = Farmer(**farmer_data.model_dump())
    db.add(db_farmer)
    await db.commit()
    await db.refresh(db_farmer)
    return db_farmer


@router.get("/", response_model=FarmerListResponse)
async def list_farmers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: int = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """生産者一覧を取得"""
    query = select(Farmer).where(Farmer.deleted_at.is_(None))
    if is_active is not None:
        query = query.where(Farmer.is_active == is_active)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    farmers = result.scalars().all()
    
    return FarmerListResponse(items=farmers, total=total or 0, skip=skip, limit=limit)


@router.get("/{farmer_id}", response_model=FarmerResponse)
async def get_farmer(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """生産者詳細を取得"""
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    return farmer


@router.put("/{farmer_id}", response_model=FarmerResponse)
async def update_farmer(
    farmer_id: int,
    farmer_data: FarmerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """生産者情報を更新"""
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    # Auto-geocode if address is changing
    if farmer_data.address is not None and farmer_data.address != farmer.address:
         coords = await route_service.get_coordinates(farmer_data.address)
         if coords:
            farmer_data.latitude = str(coords["lat"])
            farmer_data.longitude = str(coords["lng"])
            
    update_data = farmer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farmer, field, value)
    
    await db.commit()
    await db.refresh(farmer)
    return farmer


@router.delete("/{farmer_id}", response_model=ResponseMessage)
async def delete_farmer(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """生産者を削除（ソフトデリート）"""
    from datetime import datetime
    
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    farmer.deleted_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(message="生産者を削除しました", success=True)


@router.post("/{farmer_id}/generate_invite", summary="招待URL生成")
async def generate_farmer_invite(farmer_id: int, db: AsyncSession = Depends(get_db)):
    """
    農家向けの招待URLと認証コードを生成します。
    """
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
    
    # 1. Generate secure token and easy code
    new_token = secrets.token_urlsafe(32)
    new_code = str(secrets.randbelow(10000)).zfill(4)
    
    # 2. Update DB
    farmer.invite_token = new_token
    farmer.invite_code = new_code
    farmer.invite_expires_at = datetime.now() + timedelta(days=7)
    
    await db.commit()
    
    # 3. Return info
    # Get LIFF ID from env or use default (Farmer specific)
    liff_id = os.environ.get("FARMER_LIFF_ID", "2008689915-hECRflxu") 
    liff_base_url = f"https://liff.line.me/{liff_id}"
    
    # Add type=farmer param so frontend knows which LIFF ID to use
    return {
        "invite_url": f"{liff_base_url}?token={new_token}&type=farmer",
        "access_code": new_code,
        "expires_at": farmer.invite_expires_at
    }
