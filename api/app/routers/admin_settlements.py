"""
Admin Settlements Router - 月次入金/振込ステータス管理
"""
from datetime import datetime
import calendar
from typing import List, Optional, Literal

from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
from app.services.invoice import generate_monthly_invoice_pdf


router = APIRouter()


class SettlementStatusResponse(BaseModel):
    user_type: str
    user_id: int
    target_month: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    skip_reason: Optional[str] = None
    skip_note: Optional[str] = None
    notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettlementUpdateRequest(BaseModel):
    user_type: str = Field(..., description="restaurant | farmer")
    user_id: int
    target_month: Optional[str] = Field(None, description="YYYY-MM（省略時は前月）")
    action: Literal["complete", "skip", "remind"] = Field(..., description="complete | skip | remind")
    send_line: bool = Field(True, description="LINE送信するかどうか")
    skip_reason: Optional[str] = Field(None, description="スキップ理由")
    skip_note: Optional[str] = Field(None, description="スキップ備考")


class SettlementUpdateResponse(BaseModel):
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
            func.date(Order.delivery_date) <= end_date.date()
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
            func.date(Order.delivery_date) <= end_date.date()
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


@router.post("/settlements/complete", response_model=SettlementUpdateResponse)
async def complete_settlement(
    payload: SettlementUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: Admin = Depends(get_current_admin)
):
    """ステータスを更新し、必要に応じてLINE通知を送信"""
    user_type = _validate_user_type(payload.user_type)
    target_month = payload.target_month or _get_default_target_month()
    _format_month_label(target_month)

    if not await _has_orders(db, user_type, payload.user_id, target_month):
        raise HTTPException(status_code=400, detail="対象月の注文がないため送信できません")

    if payload.action == "skip" and not payload.skip_reason:
        raise HTTPException(status_code=400, detail="スキップ理由を指定してください")

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

    month_label = _format_month_label(target_month)

    # --- remind アクション: 支払催促メッセージ送信 ---
    if payload.action == "remind":
        if not line_user_id:
            raise HTTPException(status_code=400, detail="LINE未連携のため催促メッセージを送信できません")

        should_send = True
        if settings.SETTLEMENT_TEST_MODE:
            allowed_ids = _parse_test_user_ids()
            if line_user_id not in allowed_ids:
                should_send = False

        if should_send:
            # 月次まとめ請求書の金額を取得
            start_date, end_date = _get_month_range(target_month)
            orders_stmt = select(Order).where(
                Order.restaurant_id == payload.user_id,
                func.date(Order.delivery_date) >= start_date.date(),
                func.date(Order.delivery_date) <= end_date.date(),
                Order.status != OrderStatus.CANCELLED
            )
            orders_result = await db.execute(orders_stmt)
            orders = orders_result.scalars().all()
            total_amount = sum(int(o.total_amount) for o in orders)

            # 請求書PDFのURL生成
            invoice_url = str(request.url_for("download_monthly_invoice")) + f"?restaurant_id={payload.user_id}&target_month={target_month}&no_notify=true"

            # 支払期限を計算（翌月15日）
            try:
                dt = datetime.strptime(target_month, "%Y-%m")
                due_dt = dt + relativedelta(months=1)
                due_label = f"{due_dt.month}月15日"
            except ValueError:
                due_label = "翌月15日"

            remind_message = f"""いつもベジコベをご利用いただきありがとうございます。

{month_label}のご利用代金（合計 ¥{total_amount:,}）につきまして、お支払期日（{due_label}）を過ぎておりますが、当方にてご入金の確認がとれておりません。

お忙しいところ大変恐縮ではございますが、ご確認いただけますと幸いです。
下記に請求書と振込先を記載しておりますので、ご都合のよいタイミングでお手続きいただけますようお願い申し上げます。

■ お振込先
三井住友銀行 板宿支店
普通 4792089
口座名義: マツイ ユウト

■ 請求書（PDF）
{invoice_url}

※すでにお振込み済みの場合は、行き違いのご連絡となり大変申し訳ございません。何卒ご容赦くださいませ。
※ご不明な点がございましたら、お気軽にご連絡ください。"""

            token = await line_service.get_access_token(
                settings.LINE_RESTAURANT_CHANNEL_ID,
                settings.LINE_RESTAURANT_CHANNEL_SECRET,
                settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
            )
            await line_service.send_push_message(token, line_user_id, remind_message)

        return SettlementUpdateResponse(
            success=True,
            message=f"{target_name}へ{month_label}の支払催促メッセージを送信しました",
            status=SettlementStatusResponse(
                user_type=user_type,
                user_id=payload.user_id,
                target_month=target_month,
                status="pending"
            )
        )

    # --- complete / skip アクション ---
    should_send_line = payload.send_line and payload.action == "complete"
    line_sent = False

    if should_send_line and line_user_id:
        if settings.SETTLEMENT_TEST_MODE:
            allowed_ids = _parse_test_user_ids()
            if line_user_id not in allowed_ids:
                should_send_line = False

    if should_send_line and line_user_id:
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
        line_sent = True

    # Upsert status
    status_stmt = select(SettlementStatus).where(
        SettlementStatus.user_type == user_type,
        SettlementStatus.user_id == payload.user_id,
        SettlementStatus.target_month == target_month
    )
    status_result = await db.execute(status_stmt)
    status_row = status_result.scalar_one_or_none()
    now = datetime.now(ZoneInfo(settings.TZ))
    if status_row:
        status_row.status = "completed" if payload.action == "complete" else "skipped"
        status_row.completed_at = now
        status_row.skip_reason = payload.skip_reason if payload.action == "skip" else None
        status_row.skip_note = payload.skip_note if payload.action == "skip" else None
        if line_sent:
            status_row.notified_at = now
    else:
        status_row = SettlementStatus(
            user_type=user_type,
            user_id=payload.user_id,
            target_month=target_month,
            status="completed" if payload.action == "complete" else "skipped",
            completed_at=now,
            skip_reason=payload.skip_reason if payload.action == "skip" else None,
            skip_note=payload.skip_note if payload.action == "skip" else None,
            notified_at=now if line_sent else None
        )
        db.add(status_row)

    await db.commit()
    await db.refresh(status_row)

    message = "ステータスを更新しました"
    if line_sent:
        message = f"{target_name}へ通知を送信しました"
    elif payload.action == "complete":
        message = f"{target_name}のステータスを入金/振込完了に更新しました"
    else:
        message = f"{target_name}のステータスをスキップに更新しました"

    return SettlementUpdateResponse(
        success=True,
        message=message,
        status=SettlementStatusResponse.model_validate(status_row)
    )
