"""
Farmer API Router - 生産者管理
"""
from fastapi import APIRouter,Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, desc, and_, or_
from sqlalchemy.orm import selectinload
import io
import secrets
import os
from datetime import datetime, timedelta
import calendar
from decimal import Decimal

from fastapi.responses import StreamingResponse
from app.core.database import get_db
from app.core.cloudinary import upload_file
from app.services.line_notify import line_service
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

from app.core.dependencies import get_line_user_id

router = APIRouter()

# --- Helper to get current farmer ---
async def get_current_farmer(line_user_id: str, db: AsyncSession) -> Farmer:
    """
    Get the farmer associated with the current LINE user ID.
    """
    stmt = select(Farmer).where(Farmer.line_user_id == line_user_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    if not farmer:
        raise HTTPException(status_code=404, detail="生産者アカウントが見つかりません。LINE連携を確認してください。")
    return farmer


@router.get("/dashboard/sales/invoice")
async def download_payment_notice(
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    month: str = Query(..., description="対象月 (YYYY-MM)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    支払通知書（PDF）をダウンロード
    Refarmから生産者への支払通知
    """
    from app.services.invoice import generate_farmer_payment_notice_pdf
    
    # 1. Get Farmer (Auto-resolve if not provided)
    if farmer_id:
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        # Access Check
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

    try:
        target_month = datetime.strptime(month, "%Y-%m")
        # Start and end of month
        start_date = target_month.replace(day=1)
        _, last_day = calendar.monthrange(start_date.year, start_date.month)
        end_date = start_date.replace(day=last_day, hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # 2. Get Sales Data (Daily aggregated for details)
    query = (
        select(
            func.date(Order.delivery_date).label("date"),
            Product.name.label("product_name"),
            func.sum(OrderItem.total_amount).label("amount")
        )
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            Order.delivery_date >= start_date,
            Order.delivery_date <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(func.date(Order.delivery_date), Product.name)
        .order_by(func.date(Order.delivery_date))
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    details = []
    total_amount = 0
    for row in rows:
        amount = int(row.amount or 0)
        details.append({
            "date": row.date.strftime('%Y/%m/%d'),
            "product": row.product_name,
            "amount": amount
        })
        total_amount += amount
        
    period_str = f"{start_date.strftime('%Y/%m/%d')} - {end_date.strftime('%Y/%m/%d')}"
    
    # Generate PDF
    pdf_content = generate_farmer_payment_notice_pdf(farmer, total_amount, period_str, details)
    
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=payment_notice_{farmer_id}_{month}.pdf"
        }
    )

@router.post("/dashboard/sales/invoice/send_line", response_model=ResponseMessage)
async def send_payment_notice_line(
    request: Request,
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    month: str = Query(..., description="対象月 (YYYY-MM)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """支払通知書をLINEで送信"""
    # 1. Get Farmer
    if farmer_id:
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        # Access Check
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

    # Validate month format
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Construct PDF URL using API endpoint
    pdf_url = str(request.url_for("download_payment_notice")) + f"?farmer_id={farmer_id}&month={month}"

    # Send to LINE
    await line_service.send_payment_notice_message(farmer_id, month, pdf_url, line_user_id=farmer.line_user_id)
    
    return ResponseMessage(message="支払通知書をLINEに送信しました", success=True)


@router.get("/dashboard/schedule")
async def get_producer_schedule(
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    date: str = Query(..., description="日付 (YYYY-MM-DD)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者のスケジュール（出荷・準備）を取得
    """
    if farmer_id:
        # Verify access
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

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
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    month: str = Query(..., description="月 (YYYY-MM)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    生産者の売上データを取得
    """
    if farmer_id:
        # Verify access
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

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
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """生産者の商品一覧を取得"""
    if farmer_id:
        # Verify access
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

    query = select(Product).options(selectinload(Product.farmer)).where(
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
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """商品を新規登録"""
    from app.models.enums import TaxRate, StockType
    from app.core.utils import calculate_retail_price

    data = product_data.model_dump()
    farmer_id = data.get("farmer_id")

    if not farmer_id:
         farmer = await get_current_farmer(line_user_id, db)
         data["farmer_id"] = farmer.id
    else:
        # Verify access
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    
    # Producer submission defaults
    if data.get("price") is None:
        # 卸値から販売価格を自動計算 (卸値 / 0.7, 1の位四捨五入)
        if data.get("cost_price"):
            data["price"] = calculate_retail_price(data["cost_price"])
        else:
            data["price"] = Decimal(0)
            
    if data.get("tax_rate") is None:
        data["tax_rate"] = TaxRate.REDUCED
        
    if data.get("stock_type") is None:
        data["stock_type"] = StockType.KOBE

    db_product = Product(**data)
    db.add(db_product)
    await db.commit()
    
    # Re-fetch with farmer loaded for response serialization
    stmt = select(Product).options(selectinload(Product.farmer)).where(Product.id == db_product.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_producer_product(
    product_id: int,
    product_data: ProductUpdate,
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """商品情報を更新"""
    if farmer_id:
        # Verify access
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

    from app.core.utils import calculate_retail_price
    stmt = select(Product).where(Product.id == product_id, Product.deleted_at.is_(None))
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品が見つかりません")
    
    # Simple ownership check
    if product.farmer_id != farmer_id:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この商品を編集する権限がありません")

    update_data = product_data.model_dump(exclude_unset=True)
    
    # 卸値が更新された場合、販売価格を自動再計算
    if "cost_price" in update_data and "price" not in update_data:
        update_data["price"] = calculate_retail_price(update_data["cost_price"])

    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    
    # Re-fetch with farmer loaded for response serialization
    stmt = select(Product).options(selectinload(Product.farmer)).where(Product.id == product.id)
    result = await db.execute(stmt)
    return result.scalar_one()



@router.get("/profile", response_model=FarmerResponse)
async def get_producer_profile(
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """生産者プロフィールを取得"""
    if farmer_id:
        stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
    
    return farmer


@router.put("/profile", response_model=FarmerResponse)
async def update_producer_profile(
    data: FarmerUpdate,
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """生産者プロフィールを更新"""
    if farmer_id:
        stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farmer, field, value)
    
    await db.commit()
    await db.refresh(farmer)
    return farmer


@router.post("/{farmer_id}/unlink_line")
async def unlink_farmer_line(
    farmer_id: int,
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """LINE連携を解除"""
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    
    if not farmer:
        raise HTTPException(status_code=404, detail="生産者が見つかりません")
        
    if farmer.line_user_id != line_user_id:
        raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    
    farmer.line_user_id = None
    farmer.invite_token = None
    farmer.invite_code = None
    farmer.invite_expires_at = None
    
    await db.commit()
    return {"message": "LINE連携を解除しました", "success": True}


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
