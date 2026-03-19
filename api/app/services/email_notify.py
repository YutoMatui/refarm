import smtplib
from datetime import datetime
from decimal import Decimal
from email.message import EmailMessage
from typing import Iterable

import pytz

from app.core.config import settings
from app.models import Order, ConsumerOrder


class EmailNotificationService:
    def _format_currency(self, amount) -> str:
        try:
            value = Decimal(amount)
        except Exception:
            value = Decimal(0)
        return f"\u00a5{int(value):,}"

    def _format_datetime(self, value: datetime | None) -> str:
        if not value:
            return ""
        try:
            tz = pytz.timezone(settings.TZ)
            if value.tzinfo is None:
                value = tz.localize(value)
            else:
                value = value.astimezone(tz)
        except Exception:
            pass
        return value.strftime("%Y-%m-%d %H:%M")

    def _send_email(self, subject: str, html_body: str, text_body: str | None = None):
        if not settings.EMAIL_SMTP_HOST:
            print("EMAIL_SMTP_HOST is not set, skipping email notification")
            return
        if not settings.EMAIL_TO:
            print("EMAIL_TO is not set, skipping email notification")
            return

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM or settings.EMAIL_SMTP_USER or settings.EMAIL_TO
        msg["To"] = settings.EMAIL_TO
        if text_body:
            msg.set_content(text_body)
        else:
            msg.set_content("This email requires an HTML-capable email client.")
        msg.add_alternative(html_body, subtype="html")

        try:
            with smtplib.SMTP(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT) as smtp:
                if settings.EMAIL_USE_TLS:
                    smtp.starttls()
                if settings.EMAIL_SMTP_USER and settings.EMAIL_SMTP_PASSWORD:
                    smtp.login(settings.EMAIL_SMTP_USER, settings.EMAIL_SMTP_PASSWORD)
                smtp.send_message(msg)
        except Exception as exc:
            print(f"Failed to send email notification: {exc}")

    def _build_items_rows(self, items: Iterable, include_unit_price: bool = True) -> str:
        rows = []
        for item in items:
            unit_price = self._format_currency(getattr(item, "unit_price", 0))
            quantity = getattr(item, "quantity", 0)
            unit = getattr(item, "product_unit", "") or ""
            line_total = self._format_currency(getattr(item, "total_amount", 0))
            product_name = getattr(item, "product_name", "") or ""
            if include_unit_price:
                price_cell = f"<td style=\"padding:6px 8px; text-align:right;\">{unit_price}</td>"
            else:
                price_cell = ""
            rows.append(
                """
                <tr>
                    <td style=\"padding:6px 8px;\">{name}</td>
                    {price_cell}
                    <td style=\"padding:6px 8px; text-align:right;\">{qty}{unit}</td>
                    <td style=\"padding:6px 8px; text-align:right;\">{line_total}</td>
                </tr>
                """.format(
                    name=product_name,
                    price_cell=price_cell,
                    qty=quantity,
                    unit=unit,
                    line_total=line_total,
                ).strip()
            )
        return "\n".join(rows)

    def send_restaurant_order_notification(self, order: Order):
        restaurant_name = order.restaurant.name if order.restaurant else "不明"
        order_datetime = self._format_datetime(order.created_at)

        items_rows = self._build_items_rows(order.order_items, include_unit_price=True)
        html_body = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; color:#222;\">
            <h2 style=\"margin:0 0 12px;\">新しい注文（飲食店）</h2>
            <p style=\"margin:0 0 8px;\">注文者: <strong>{restaurant_name}</strong></p>
            <p style=\"margin:0 0 16px;\">注文日時: {order_datetime}</p>
            <table style=\"border-collapse:collapse; width:100%; max-width:720px;\" border=\"1\" cellspacing=\"0\" cellpadding=\"0\">
                <thead>
                    <tr style=\"background:#f5f5f5;\">
                        <th style=\"padding:6px 8px; text-align:left;\">商品</th>
                        <th style=\"padding:6px 8px; text-align:right;\">単価</th>
                        <th style=\"padding:6px 8px; text-align:right;\">数量</th>
                        <th style=\"padding:6px 8px; text-align:right;\">金額</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows}
                </tbody>
            </table>
            <p style=\"margin:12px 0 0;\">小計: {self._format_currency(order.subtotal)}</p>
            <p style=\"margin:0;\">消費税: {self._format_currency(order.tax_amount)}</p>
            <p style=\"margin:0;\">送料: {self._format_currency(order.shipping_fee)}</p>
            <p style=\"margin:8px 0 0; font-size:16px;\"><strong>合計: {self._format_currency(order.total_amount)}</strong></p>
        </body>
        </html>
        """.strip()

        text_body = (
            f"新しい注文（飲食店）\n"
            f"注文者: {restaurant_name}\n"
            f"注文日時: {order_datetime}\n"
            f"合計: {self._format_currency(order.total_amount)}\n"
        )

        self._send_email(
            subject=f"[Refarm] 新しい注文（飲食店） #{order.id}",
            html_body=html_body,
            text_body=text_body,
        )

    def send_consumer_order_notification(self, order: ConsumerOrder):
        consumer_name = "一般消費者"
        if getattr(order, "consumer", None) and order.consumer.name:
            consumer_name = order.consumer.name
        order_datetime = self._format_datetime(order.created_at)

        items_rows = self._build_items_rows(order.order_items, include_unit_price=True)
        html_body = f"""
        <html>
        <body style=\"font-family: Arial, sans-serif; color:#222;\">
            <h2 style=\"margin:0 0 12px;\">新しい注文（消費者）</h2>
            <p style=\"margin:0 0 8px;\">注文者: <strong>{consumer_name}</strong></p>
            <p style=\"margin:0 0 16px;\">注文日時: {order_datetime}</p>
            <table style=\"border-collapse:collapse; width:100%; max-width:720px;\" border=\"1\" cellspacing=\"0\" cellpadding=\"0\">
                <thead>
                    <tr style=\"background:#f5f5f5;\">
                        <th style=\"padding:6px 8px; text-align:left;\">商品</th>
                        <th style=\"padding:6px 8px; text-align:right;\">単価</th>
                        <th style=\"padding:6px 8px; text-align:right;\">数量</th>
                        <th style=\"padding:6px 8px; text-align:right;\">金額</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows}
                </tbody>
            </table>
            <p style=\"margin:12px 0 0;\">小計: {self._format_currency(order.subtotal)}</p>
            <p style=\"margin:0;\">消費税: {self._format_currency(order.tax_amount)}</p>
            <p style=\"margin:0;\">送料: {self._format_currency(order.shipping_fee)}</p>
            <p style=\"margin:8px 0 0; font-size:16px;\"><strong>合計: {self._format_currency(order.total_amount)}</strong></p>
        </body>
        </html>
        """.strip()

        text_body = (
            f"新しい注文（消費者）\n"
            f"注文者: {consumer_name}\n"
            f"注文日時: {order_datetime}\n"
            f"合計: {self._format_currency(order.total_amount)}\n"
        )

        self._send_email(
            subject=f"[Refarm] 新しい注文（消費者） #{order.id}",
            html_body=html_body,
            text_body=text_body,
        )


email_service = EmailNotificationService()
