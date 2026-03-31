"""
Admin Settlements Router - 月次入金/振込ステータス管理
"""
from datetime import datetime
import calendar
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.admin import Admin
from app.models.farmer import Farmer
from app.models.restaurant import Restaurant
from app.models.settlement_status import SettlementStatus
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.enums import OrderStatus
from app.routers.admin_auth import get_current_admin
from app.services.line_notify import line_service


router = APIRouter()


class SettlementStatusResponse(BaseModel):
    user_type: str
    user_id: int
    target_month: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettlementCompleteRequest(BaseModel):
    user_type: str = Field(..., description="restaurant | farmer")
    user_id: int
    target_month: Optional[str] = Field(None, description="YYYY-MM（省略時は前月）")


class SettlementCompleteResponse(BaseModel):
    success: bool
    message: str
    status: SettlementStatusResponse


def _get_default_target_month() -> str:
    tz = ZoneInfo(settings.TZ)
    now = datetime.now(tz)
    target = now - relativedelta(months=1)
    return target.strftime("%Y-%m")


def _format_month_label(target_month: str) -> str:
    try:
        dt = datetime.strptime(target_month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="target_month は YYYY-MM 形式で指定してください")
    return f"{dt.month}月分"


def _get_month_range(target_month: str) -> tuple[datetime, datetime]:
    try:
        year_str, month_str = target_month.split("-")
        year = int(year_str)
        month = int(month_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="target_month は YYYY-MM 形式で指定してください")

    start_date = datetime(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59)
    return start_date, end_date


async def _get_order_user_ids(db: AsyncSession, user_type: str, target_month: str) -> list[int]:
    start_date, end_date = _get_month_range(target_month)

    if user_type == "restaurant":
        stmt = select(Order.restaurant_id).where(
            func.date(Order.delivery_date) >= start_date.date(),
            func.date(Order.delivery_date) <= end_date.date(),
            Order.status != OrderStatus.CANCELLED
        ).distinct()
    else:
        stmt = select(Product.farmer_id).select_from(OrderItem).join(
            Order, OrderItem.order_id == Order.id
        ).join(
            Product, OrderItem.product_id == Product.id
        ).where(
            Product.farmer_id.isnot(None),
            func.date(Order.delivery_date) >= start_date.date(),
            func.date(Order.delivery_date) <= end_date.date(),
            Order.status != OrderStatus.CANCELLED
        ).distinct()

    result = await db.execute(stmt)
    return [row[0] for row in result.all() if row[0] is not None]


async def _has_orders(db: AsyncSession, user_type: str, user_id: int, target_month: str) -> bool:
    start_date, end_date = _get_month_range(target_month)

    if user_type == "restaurant":
        stmt = select(Order.id).where(
            Order.restaurant_id == user_id,
            func.date(Order.delivery_date) >= start_date.date(),
            func.date(Order.delivery_date) <= end_date.date(),
            Order.status != OrderStatus.CANCELLED
        ).limit(1)
    else:
        stmt = select(OrderItem.id).select_from(OrderItem).join(
            Order, OrderItem.order_id == Order.id
        ).join(
            Product, OrderItem.product_id == Product.id
        ).where(
            Product.farmer_id == user_id,
            func.date(Order.delivery_date) >= start_date.date(),
            func.date(Order.delivery_date) <= end_date.date(),
            Order.status != OrderStatus.CANCELLED
        ).limit(1)

    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


def _parse_test_user_ids() -> List[str]:
    raw = (settings.SETTLEMENT_TEST_USER_IDS or "").strip()
    if not raw:
        if settings.LINE_TEST_USER_ID:
            return [settings.LINE_TEST_USER_ID]
        return []
    return [v.strip() for v in raw.split(",") if v.strip()]


def _validate_user_type(user_type: str) -> str:
    if user_type not in {"restaurant", "farmer"}:
        raise HTTPException(status_code=400, detail="user_type は restaurant または farmer を指定してください")
    return user_type


@router.get("/settlements/status", response_model=List[SettlementStatusResponse])
async def list_settlement_statuses(
    user_type: str = Query(..., description="restaurant | farmer"),
    target_month: Optional[str] = Query(None, description="YYYY-MM（省略時は前月）"),
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_admin)
):
    """指定月のステータス一覧を取得（未登録は未払い扱い）"""
    user_type = _validate_user_type(user_type)
    month = target_month or _get_default_target_month()
    _format_month_label(month)

    target_user_ids = await _get_order_user_ids(db, user_type, month)
    if not target_user_ids:
        return []
    target_user_ids = sorted(set(target_user_ids))

    stmt = select(SettlementStatus).where(
        SettlementStatus.user_type == user_type,
        SettlementStatus.target_month == month,
        SettlementStatus.user_id.in_(target_user_ids)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    status_map = {row.user_id: row for row in rows}

    responses: list[SettlementStatusResponse] = []
    for user_id in target_user_ids:
        row = status_map.get(user_id)
        if row:
            responses.append(SettlementStatusResponse.model_validate(row))
        else:
            responses.append(SettlementStatusResponse(
                user_type=user_type,
                user_id=user_id,
                target_month=month,
                status="pending"
            ))
    return responses


@router.post("/settlements/complete", response_model=SettlementCompleteResponse)
async def complete_settlement(
    payload: SettlementCompleteRequest,
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_admin)
):
    """ステータスを完了に更新し、LINE通知を送信"""
    user_type = _validate_user_type(payload.user_type)
    target_month = payload.target_month or _get_default_target_month()
    _format_month_label(target_month)

    if not await _has_orders(db, user_type, payload.user_id, target_month):
        raise HTTPException(status_code=400, detail="対象月の注文がないため送信できません")

    if user_type == "restaurant":
        stmt = select(Restaurant).where(Restaurant.id == payload.user_id)
        result = await db.execute(stmt)
        target = result.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="飲食店が見つかりません")
        line_user_id = target.line_user_id
        target_name = target.name
    else:
        stmt = select(Farmer).where(Farmer.id == payload.user_id)
        result = await db.execute(stmt)
        target = result.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="農家が見つかりません")
        line_user_id = getattr(target, "line_user_id", None)
        target_name = target.name

    if not line_user_id:
        raise HTTPException(status_code=400, detail="LINE未連携のため送信できません")

    if settings.SETTLEMENT_TEST_MODE:
        allowed_ids = _parse_test_user_ids()
        if line_user_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="テスト送信制限中のため、このユーザーには送信できません"
            )

    month_label = _format_month_label(target_month)
    if user_type == "restaurant":
        message = f"""いつもベジコベをご利用いただきありがとうございます。

{month_label}のご利用代金について、当方にてご入金を確認いたしました。
速やかなご対応、誠にありがとうございます。
引き続き、美味しいお野菜をお届けしてまいりますので、よろしくお願いいたします。"""
        token = await line_service.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET,
            settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
        )
    else:
        message = f"""いつも美味しいお野菜を出品いただき、ありがとうございます。

{month_label}の売上代金について、ご指定の口座へお振込みの手続きを完了いたしました。
お手数をおかけしますが、ご都合の良い時に口座の入金状況をご確認ください。
※金額の詳細につきましては、アプリ内の売上履歴よりご確認いただけます。"""
        token = await line_service.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
        )

    await line_service.send_push_message(token, line_user_id, message)

    # Upsert status
    status_stmt = select(SettlementStatus).where(
        SettlementStatus.user_type == user_type,
        SettlementStatus.user_id == payload.user_id,
        SettlementStatus.target_month == target_month
    )
    status_result = await db.execute(status_stmt)
    status_row = status_result.scalar_one_or_none()
    if status_row:
        status_row.status = "completed"
        status_row.completed_at = datetime.now(ZoneInfo(settings.TZ))
    else:
        status_row = SettlementStatus(
            user_type=user_type,
            user_id=payload.user_id,
            target_month=target_month,
            status="completed",
            completed_at=datetime.now(ZoneInfo(settings.TZ))
        )
        db.add(status_row)

    await db.commit()
    await db.refresh(status_row)

    return SettlementCompleteResponse(
        success=True,
        message=f"{target_name}へ通知を送信しました",
        status=SettlementStatusResponse.model_validate(status_row)
    )
