"""
Order API Router - 注文管理
"""
import io
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.core.cloudinary import upload_file
from app.services.invoice import generate_invoice_pdf
from app.services.line_notify import line_service
from app.models import Order, OrderItem, Product, Farmer
from app.models.enums import OrderStatus
from app.schemas import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderListResponse,
    OrderStatusUpdate,
    ResponseMessage,
)

router = APIRouter()


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    注文を新規作成
    商品の価格スナップショットを保存し、合計金額を計算
    """
    # Create order
    order_dict = order_data.model_dump(exclude={"items"})
    db_order = Order(**order_dict)
    db.add(db_order)
    await db.flush()
    
    # Calculate totals
    subtotal = Decimal(0)
    tax_amount = Decimal(0)
    
    # Create order items
    for item_data in order_data.items:
        # Get product
        stmt = select(Product).where(Product.id == item_data.product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"商品ID {item_data.product_id} が見つかりません"
            )
        
        if product.is_active != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"商品「{product.name}」は現在販売されていません"
            )
        
        # Calculate prices
        item_subtotal = product.price * item_data.quantity
        item_tax = item_subtotal * (Decimal(product.tax_rate.value) / 100)
        item_total = item_subtotal + item_tax
        
        # Create order item
        db_order_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=item_data.quantity,
            unit_price=product.price,
            tax_rate=product.tax_rate.value,
            subtotal=item_subtotal,
            tax_amount=item_tax,
            total_amount=item_total,
            product_name=product.name,
            product_unit=product.unit,
        )
        db.add(db_order_item)
        
        subtotal += item_subtotal
        tax_amount += item_tax
    
    # Update order totals
    db_order.subtotal = subtotal
    db_order.tax_amount = tax_amount
    db_order.total_amount = subtotal + tax_amount
    
    await db.commit()
    
    # Reload order with items to ensure all fields (IDs, timestamps) are populated
    # and items are eagerly loaded for the response to prevent MissingGreenlet error
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == db_order.id)
    result = await db.execute(stmt)
    db_order = result.scalar_one()
    
    # Send LINE Notifications
    background_tasks.add_task(line_service.notify_restaurant, db_order)
    background_tasks.add_task(line_service.notify_farmers, db_order)
    
    return db_order


@router.get("/", response_model=OrderListResponse)
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    restaurant_id: int = Query(None),
    status_filter: OrderStatus = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db)
):
    """注文一覧を取得"""
    query = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    )
    
    if restaurant_id:
        query = query.where(Order.restaurant_id == restaurant_id)
    if status_filter:
        query = query.where(Order.status == status_filter)
    
    # Count query - simpler and safer
    count_stmt = select(func.count(Order.id))
    if restaurant_id:
        count_stmt = count_stmt.where(Order.restaurant_id == restaurant_id)
    if status_filter:
        count_stmt = count_stmt.where(Order.status == status_filter)
    
    total = await db.scalar(count_stmt)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return OrderListResponse(items=orders, total=total or 0, skip=skip, limit=limit)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """注文詳細を取得"""
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    return order


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db)
):
    """注文情報を更新"""
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # Update fields
    update_data = order_data.model_dump(exclude_unset=True)
    
    # Handle status change logic if status is present
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status != order.status:
            now = datetime.now()
            if new_status == OrderStatus.CONFIRMED:
                order.confirmed_at = now
            elif new_status == OrderStatus.SHIPPED:
                order.shipped_at = now
            elif new_status == OrderStatus.DELIVERED:
                order.delivered_at = now
            elif new_status == OrderStatus.CANCELLED:
                order.cancelled_at = now
    
    for field, value in update_data.items():
        setattr(order, field, value)
    
    await db.commit()
    await db.refresh(order)
    
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """注文ステータスを更新"""
    stmt = select(Order).where(Order.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # Update status and timestamp
    order.status = status_update.status
    
    now = datetime.now()
    if status_update.status == OrderStatus.CONFIRMED:
        order.confirmed_at = now
    elif status_update.status == OrderStatus.SHIPPED:
        order.shipped_at = now
    elif status_update.status == OrderStatus.DELIVERED:
        order.delivered_at = now
    elif status_update.status == OrderStatus.CANCELLED:
        order.cancelled_at = now
    
    await db.commit()
    
    # Reload order with items to ensure all fields are populated and items are loaded
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order.id)
    result = await db.execute(stmt)
    order = result.scalar_one()
    
    return order


@router.delete("/{order_id}", response_model=ResponseMessage)
async def cancel_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """注文をキャンセル"""
    stmt = select(Order).where(Order.id == order_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    if order.status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="配送中または配達完了の注文はキャンセルできません"
        )
    
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now()
    await db.commit()
    
    return ResponseMessage(message="注文をキャンセルしました", success=True)


@router.post("/{order_id}/send_invoice_line", response_model=ResponseMessage)
async def send_invoice_line(order_id: int, db: AsyncSession = Depends(get_db)):
    """請求書を生成してLINEに送信"""
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # 1. Generate PDF
    pdf_content = generate_invoice_pdf(order)
    
    # 2. Upload to Cloudinary
    # We use io.BytesIO to wrap bytes
    file_obj = io.BytesIO(pdf_content)
    # Filename helps Cloudinary set format? resource_type='raw' is usually better for PDFs or 'auto'
    # public_id helps keep it organized
    public_id = f"invoice_{order.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Run upload in thread pool to avoid blocking async loop
    import asyncio
    from functools import partial
    
    # Cloudinary upload is sync
    loop = asyncio.get_event_loop()
    # Use resource_type='image' and format='pdf' to ensure viewable PDF
    upload_result = await loop.run_in_executor(
        None, 
        partial(upload_file, file_obj, folder="refarm/invoices", resource_type="image", public_id=public_id, format="pdf")
    )
    
    if not upload_result or 'secure_url' not in upload_result:
        # Fallback or Error
        # If cloudinary fails, maybe just error out or return specific message
        raise HTTPException(status_code=500, detail="PDFアップロードに失敗しました")
        
    pdf_url = upload_result['secure_url']
    
    # 3. Send to LINE
    await line_service.send_invoice_message(order, pdf_url)
    
    # 4. Save URL to order (optional but good)
    order.invoice_url = pdf_url
    await db.commit()
    
    return ResponseMessage(message="請求書をLINEに送信しました", success=True)


@router.get("/{order_id}/invoice")
async def download_invoice(
    order_id: int, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """請求書をダウンロード"""
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # Generate PDF
    pdf_content = generate_invoice_pdf(order)

    # Background Task: Upload and Send to LINE
    async def upload_and_send_line(order_obj, pdf_bytes):
        try:
            # Upload to Cloudinary
            file_obj = io.BytesIO(pdf_bytes)
            public_id = f"invoice_{order_obj.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            import asyncio
            from functools import partial
            
            loop = asyncio.get_event_loop()
            # Use resource_type='image' and format='pdf' to ensure viewable PDF
            upload_result = await loop.run_in_executor(
                None, 
                partial(upload_file, file_obj, folder="refarm/invoices", resource_type="image", public_id=public_id, format="pdf")
            )
            
            if upload_result and 'secure_url' in upload_result:
                pdf_url = upload_result['secure_url']
                # Send to LINE
                await line_service.send_invoice_message(order_obj, pdf_url)
                
                # Update DB (Need new session)
                # Since we can't easily get a new session here without dependency injection, 
                # and the main session is closed, we might skip saving the URL or use a context manager if strictly needed.
                # For now, sending the message is the priority.
        except Exception as e:
            print(f"Failed to send invoice to LINE: {e}")

    background_tasks.add_task(upload_and_send_line, order, pdf_content)
    
    # Return as stream
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{order.id}.pdf"
        }
    )

@router.get("/{order_id}/delivery_slip")
async def download_delivery_slip(order_id: int, db: AsyncSession = Depends(get_db)):
    """納品書をダウンロード"""
    from app.services.invoice import generate_delivery_slip_pdf
    
    stmt = select(Order).options(
        selectinload(Order.order_items).selectinload(OrderItem.product).selectinload(Product.farmer),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # Generate PDF
    pdf_content = generate_delivery_slip_pdf(order)
    
    # Return as stream
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=delivery_slip_{order.id}.pdf"
        }
    )


@router.get("/invoice/monthly")
async def download_monthly_invoice(
    restaurant_id: int,
    target_month: str = Query(..., description="対象月 (YYYY-MM)"),
    db: AsyncSession = Depends(get_db)
):
    """月次請求書をダウンロード"""
    from app.services.invoice import generate_monthly_invoice_pdf
    from app.models.restaurant import Restaurant
    from datetime import timedelta
    import calendar

    # 1. Get Restaurant
    stmt = select(Restaurant).where(Restaurant.id == restaurant_id)
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="飲食店が見つかりません")

    # 2. Determine Date Range based on closing_date
    try:
        year_str, month_str = target_month.split('-')
        year = int(year_str)
        month = int(month_str)
        
        closing_day = restaurant.closing_date or 99 # Default to end of month
        
        if closing_day >= 28: # End of month logic
            start_date = datetime(year, month, 1).date()
            _, last_day = calendar.monthrange(year, month)
            end_date = datetime(year, month, last_day).date()
        else:
            # e.g. closing 20th. Target 2025-12 means 2025-11-21 to 2025-12-20
            # Calculate Previous Month
            if month == 1:
                prev_month_year = year - 1
                prev_month = 12
            else:
                prev_month_year = year
                prev_month = month - 1
            
            start_date = datetime(prev_month_year, prev_month, closing_day + 1).date()
            end_date = datetime(year, month, closing_day).date()
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # 3. Fetch Orders in Range
    # Use delivery_date for invoice calculation usually
    stmt = select(Order).where(
        Order.restaurant_id == restaurant_id,
        func.date(Order.delivery_date) >= start_date,
        func.date(Order.delivery_date) <= end_date,
        Order.status != OrderStatus.CANCELLED
    ).order_by(Order.delivery_date)
    
    result = await db.execute(stmt)
    orders = result.scalars().all()
    
    if not orders:
        # Allow empty invoice generation? Usually better to warn.
        # But for UI consistency, maybe generate a zero invoice or error.
        pass 

    # 4. Generate PDF
    # Format period string
    period_str = f"{start_date.strftime('%Y/%m/%d')} - {end_date.strftime('%Y/%m/%d')}"
    target_month_label = f"{year}年{month}月度"
    
    pdf_content = generate_monthly_invoice_pdf(restaurant, orders, target_month_label, period_str)
    
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_monthly_{restaurant_id}_{target_month}.pdf"
        }
    )


@router.get("/aggregation/daily", response_model=list[dict])
async def get_daily_aggregation(
    date: str = Query(..., description="集計日 (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    """
    指定日の仕入れ集計を取得
    農家ごとに必要な野菜の総数を返す
    """
    from app.models import Farmer
    from datetime import datetime, time
    
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="日付の形式はYYYY-MM-DDである必要があります"
        )
        
    # Start and end of the day
    start_of_day = datetime.combine(target_date, time.min)
    end_of_day = datetime.combine(target_date, time.max)
    
    # Query: Join Order -> OrderItem -> Product -> Farmer
    # Filter by Order.delivery_date
    stmt = (
        select(
            Farmer.id.label("farmer_id"),
            Farmer.name.label("farmer_name"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("product_unit"),
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .select_from(Order)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .join(Farmer, Product.farmer_id == Farmer.id)
        .where(
            func.date(Order.delivery_date) == target_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(
            Farmer.id,
            Farmer.name,
            Product.id,
            Product.name,
            Product.unit
        )
        .order_by(Farmer.id, Product.id)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Group by Farmer in Python
    aggregation = {}
    for row in rows:
        farmer_id = row.farmer_id
        if farmer_id not in aggregation:
            aggregation[farmer_id] = {
                "farmer_name": row.farmer_name,
                "products": []
            }
        
        aggregation[farmer_id]["products"].append({
            "product_name": row.product_name,
            "quantity": int(row.total_quantity or 0),
            "unit": row.product_unit
        })
        
    return list(aggregation.values())
        

@router.get("/aggregation/monthly", response_model=list[dict])
async def get_monthly_aggregation(
    date: str = Query(..., description="集計月 (YYYY-MM)"),
    db: AsyncSession = Depends(get_db)
):
    """
    指定月の仕入れ集計を取得
    農家ごとに必要な野菜の総数を返す
    """
    from app.models import Farmer
    from datetime import datetime
    import calendar
    
    try:
        # Check format YYYY-MM
        year_str, month_str = date.split('-')
        year = int(year_str)
        month = int(month_str)
        
        # Determine start and end of month
        start_date = datetime(year, month, 1).date()
        _, last_day = calendar.monthrange(year, month)
        end_date = datetime(year, month, last_day).date()
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="日付の形式はYYYY-MMである必要があります"
        )
        
    # Query: Join Order -> OrderItem -> Product -> Farmer
    # Filter by Order.delivery_date within the month range
    stmt = (
        select(
            Farmer.id.label("farmer_id"),
            Farmer.name.label("farmer_name"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.unit.label("product_unit"),
            func.sum(OrderItem.quantity).label("total_quantity")
        )
        .select_from(Order)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .join(Product, OrderItem.product_id == Product.id)
        .join(Farmer, Product.farmer_id == Farmer.id)
        .where(
            func.date(Order.delivery_date) >= start_date,
            func.date(Order.delivery_date) <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(
            Farmer.id,
            Farmer.name,
            Product.id,
            Product.name,
            Product.unit
        )
        .order_by(Farmer.id, Product.id)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Group by Farmer in Python
    aggregation = {}
    for row in rows:
        farmer_id = row.farmer_id
        if farmer_id not in aggregation:
            aggregation[farmer_id] = {
                "farmer_name": row.farmer_name,
                "products": []
            }
        
        aggregation[farmer_id]["products"].append({
            "product_name": row.product_name,
            "quantity": int(row.total_quantity or 0),
            "unit": row.product_unit
        })
        
    return list(aggregation.values())
