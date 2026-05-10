"""
Public API Router - 認証不要の公開エンドポイント
署名付きURLで支払通知書等のPDFを配信
"""
import hmac
import hashlib
import io
from datetime import datetime
import calendar

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import Depends

from app.core.database import get_db
from app.core.config import settings
from app.models import Farmer, Product, Order, OrderItem
from app.models.enums import OrderStatus

router = APIRouter()


def generate_signature(farmer_id: int, month: str) -> str:
    """farmer_idとmonthからHMAC署名を生成"""
    message = f"payment_notice:{farmer_id}:{month}"
    return hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()


def verify_signature(farmer_id: int, month: str, sig: str) -> bool:
    """署名を検証"""
    expected = generate_signature(farmer_id, month)
    return hmac.compare_digest(expected, sig)


@router.get("/payment-notice")
async def public_payment_notice(
    farmer_id: int = Query(...),
    month: str = Query(...),
    sig: str = Query(..., description="HMAC署名"),
    db: AsyncSession = Depends(get_db)
):
    """署名付きURLで支払通知書PDFを配信（認証不要）"""
    from app.services.invoice import generate_farmer_payment_notice_pdf

    # 署名検証
    if not verify_signature(farmer_id, month, sig):
        raise HTTPException(status_code=403, detail="無効なリンクです")

    # Farmer取得
    stmt = select(Farmer).where(Farmer.id == farmer_id, Farmer.deleted_at.is_(None))
    result = await db.execute(stmt)
    farmer = result.scalar_one_or_none()
    if not farmer:
        raise HTTPException(status_code=404, detail="生産者が見つかりません")

    # 月の範囲
    try:
        target_month = datetime.strptime(month, "%Y-%m")
        start_date = target_month.replace(day=1)
        _, last_day = calendar.monthrange(start_date.year, start_date.month)
        end_date = start_date.replace(day=last_day, hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format")

    # 売上データ取得
    query = (
        select(
            func.date(Order.delivery_date).label("date"),
            Product.name.label("product_name"),
            func.sum(func.coalesce(OrderItem.wholesale_price, 0) * OrderItem.quantity).label("amount")
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

    # PDF生成
    pdf_content = generate_farmer_payment_notice_pdf(farmer, total_amount, period_str, details)

    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=payment_notice_{farmer_id}_{month}.pdf"
        }
    )
