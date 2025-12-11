"""
Order API Router - 注文管理
"""
import io
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.services.invoice import generate_invoice_pdf
from app.models import Order, OrderItem, Product
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
async def create_order(order_data: OrderCreate, db: AsyncSession = Depends(get_db)):
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
    stmt = select(Order).options(selectinload(Order.order_items)).where(Order.id == db_order.id)
    result = await db.execute(stmt)
    db_order = result.scalar_one()
    
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
    query = select(Order).options(selectinload(Order.order_items))
    
    if restaurant_id:
        query = query.where(Order.restaurant_id == restaurant_id)
    if status_filter:
        query = query.where(Order.status == status_filter)
    
    # Order by created_at desc
    query = query.order_by(Order.created_at.desc())
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return OrderListResponse(items=orders, total=total or 0, skip=skip, limit=limit)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """注文詳細を取得"""
    stmt = select(Order).options(selectinload(Order.order_items)).where(Order.id == order_id)
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
    stmt = select(Order).options(selectinload(Order.order_items)).where(Order.id == order_id)
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
    stmt = select(Order).options(selectinload(Order.order_items)).where(Order.id == order.id)
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


@router.get("/{order_id}/invoice")
async def download_invoice(order_id: int, db: AsyncSession = Depends(get_db)):
    """請求書をダウンロード"""
    stmt = select(Order).options(
        selectinload(Order.order_items),
        selectinload(Order.restaurant)
    ).where(Order.id == order_id)
    
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文が見つかりません")
    
    # Generate PDF
    pdf_content = generate_invoice_pdf(order)
    
    # Return as stream
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{order.id}.pdf"
        }
    )
