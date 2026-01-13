import httpx
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any
from app.core.config import settings
from app.models import Order, OrderItem, ConsumerOrder
from app.models.enums import DeliverySlotType

class LineNotificationService:
    BASE_URL = "https://api.line.me"
    
    def __init__(self):
        self.restaurant_token = None
        self.restaurant_token_expires = 0
        self.producer_token = None
        self.producer_token_expires = 0
        
    async def get_access_token(self, channel_id: str, channel_secret: str) -> str:
        """
        Get Channel Access Token (v2.1)
        Note: In a real app, this should be cached properly (Redis/DB)
        For this sandbox, we'll fetch it if not cached in memory
        """
        # Simple in-memory cache check (not perfect for multi-worker but ok for demo)
        if channel_id == settings.LINE_RESTAURANT_CHANNEL_ID and self.restaurant_token:
            return self.restaurant_token
        if channel_id == settings.LINE_PRODUCER_CHANNEL_ID and self.producer_token:
            return self.producer_token

        async with httpx.AsyncClient() as client:
            payload = {
                "grant_type": "client_credentials",
                "client_id": channel_id,
                "client_secret": channel_secret
            }
            # The Content-Type must be correctly handled by passing `data` for x-www-form-urlencoded
            response = await client.post(
                f"{self.BASE_URL}/v2/oauth/accessToken",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            # Additional check for better error messages
            if response.status_code != 200:
                print(f"LINE Token Error: {response.status_code} - {response.text}")
                response.raise_for_status()
            
            data = response.json()
            
            token = data["access_token"]
            
            if channel_id == settings.LINE_RESTAURANT_CHANNEL_ID:
                self.restaurant_token = token
            else:
                self.producer_token = token
                
            return token

    async def send_push_message(self, token: str, to_user_id: str, text: str):
        """Send a push message"""
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            payload = {
                "to": to_user_id,
                "messages": [{"type": "text", "text": text}]
            }
            response = await client.post(
                f"{self.BASE_URL}/v2/bot/message/push",
                json=payload,
                headers=headers
            )
            # Log error but don't raise to prevent order failure
            if response.status_code != 200:
                print(f"Failed to send LINE message: {response.text}")

    def format_currency(self, amount) -> str:
        return f"¥{int(amount):,}"

    def format_currency_plain(self, amount) -> str:
        try:
            value = Decimal(amount)
        except Exception:
            value = Decimal(0)
        return f"{int(value):,}円"

    def format_date(self, date_obj) -> str:
        if not date_obj:
            return ""
        # Format: 12月24日(水)
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        return f"{date_obj.month}月{date_obj.day}日({weekdays[date_obj.weekday()]})"

    def format_time_slot(self, slot_value: str) -> str:
        if not slot_value:
            return ""
        # Assuming values like "12-14"
        parts = slot_value.split("-")
        if len(parts) == 2:
            return f"{parts[0]}:00～{parts[1]}:00"
        return slot_value

    async def notify_restaurant(self, order: Order):
        """Send notification to restaurant"""
        target_user_id = None
        
        # 1. Try to get restaurant's LINE User ID
        if order.restaurant and order.restaurant.line_user_id:
            target_user_id = order.restaurant.line_user_id
            
        # 2. Fallback to test user only if configured and no restaurant ID
        # or if explicitly in debug mode and we want to duplicate? 
        # The user complaint is that it goes to THEM (Test User) instead of Restaurant.
        if not target_user_id:
            if settings.LINE_TEST_USER_ID:
                print(f"Restaurant {order.restaurant_id} has no LINE ID, using test user")
                target_user_id = settings.LINE_TEST_USER_ID
            else:
                print("No target user ID for restaurant notification")
                return

        token = await self.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET
        )

        # Format items
        items_text = ""
        for item in order.order_items:
            # Assuming item.product and item.product.farmer are loaded
            product_name = item.product_name
            farmer_name = item.product.farmer.name if item.product and item.product.farmer else "生産者"
            
            # Simple emoji logic based on name (optional, keeping it simple or random)
            emoji = "🥬"  # Default
            if "人参" in product_name: emoji = "🥕"
            elif "トマト" in product_name: emoji = "🍅"
            
            items_text += f"{emoji} {product_name}（{farmer_name}）\n"
            items_text += f"   数量: {item.quantity}{item.product_unit}\n"
            items_text += f"   金額: {self.format_currency(item.total_amount)}\n"

        delivery_date_str = self.format_date(order.delivery_date)
        delivery_time = self.format_time_slot(order.delivery_time_slot.value if hasattr(order.delivery_time_slot, 'value') else str(order.delivery_time_slot))

        message = f"""【ご注文ありがとうございます🌿】
KOBE Veggie Worksをご利用いただきありがとうございます。
以下の内容で生産者へ手配いたしました。

■ お届け予定日
{delivery_date_str} {delivery_time}

■ ご注文内容
------------------------
No. {order.id}
------------------------
{items_text}------------------------
合計金額: {self.format_currency(order.total_amount)} (税込)

到着まで今しばらくお待ちください👨‍🍳"""

        await self.send_push_message(token, target_user_id, message)

    async def notify_farmers(self, order: Order):
        """Send notification to farmers"""
        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET
        )

        # Group items by farmer
        farmers_items = {}
        for item in order.order_items:
            # item.product.farmer should be loaded via selectinload in router
            if not item.product or not item.product.farmer:
                continue
                
            farmer = item.product.farmer
            farmer_id = farmer.id
            
            # Check if farmer has LINE linked
            if not farmer.line_user_id:
                continue
                
            if farmer_id not in farmers_items:
                farmers_items[farmer_id] = {
                    "farmer_name": farmer.name,
                    "line_user_id": farmer.line_user_id,
                    "items": [],
                    "total_sales": 0
                }
            farmers_items[farmer_id]["items"].append(item)
            farmers_items[farmer_id]["total_sales"] += item.total_amount

        for farmer_id, data in farmers_items.items():
            farmer_name = data["farmer_name"]
            target_user_id = data["line_user_id"]
            
            items_text = ""
            for item in data["items"]:
                emoji = "📦"
                if "人参" in item.product_name: emoji = "🥕"
                elif "トマト" in item.product_name: emoji = "🍅"
                elif "ネギ" in item.product_name: emoji = "🥬"
                
                items_text += f"{emoji} {item.product_name}\n"
                items_text += f"   数量: {item.quantity}{item.product_unit}\n"
                
            delivery_date_str = self.format_date(order.delivery_date)
            
            message = f"""【🎉 注文が入りました！】
{farmer_name}さん、お疲れ様です！
飲食店から注文が入りました。収穫・出荷の準備をお願いします。

■ 出荷期限
明日 {delivery_date_str} 午前10時まで

■ 収穫リスト
{items_text}
------------------------
💰 今回の売上予定: {self.format_currency(data["total_sales"])}
------------------------

お野菜のご準備、よろしくお願いいたします！🚛"""

            await self.send_push_message(token, target_user_id, message)

    async def notify_consumer_order(self, order: ConsumerOrder):
        """Send confirmation message to consumer."""
        consumer = getattr(order, "consumer", None)
        target_user_id = None
        if consumer and consumer.line_user_id:
            target_user_id = consumer.line_user_id
        elif settings.LINE_TEST_USER_ID:
            target_user_id = settings.LINE_TEST_USER_ID
        else:
            print("No target user ID for consumer notification")
            return

        token = await self.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET
        )

        items_lines = ""
        for item in order.order_items:
            items_lines += f"・{item.product_name} × {item.quantity}\n"
        if not items_lines:
            items_lines = "・商品情報が取得できませんでした\n"

        subtotal_text = self.format_currency_plain(order.subtotal)
        shipping_label = order.delivery_label or "受取"
        shipping_text = self.format_currency_plain(order.shipping_fee)
        total_text = self.format_currency_plain(order.total_amount)

        pickup_place = "ご自宅" if order.delivery_type == DeliverySlotType.HOME else shipping_label
        time_label = order.delivery_time_label or (order.delivery_slot.time_text if order.delivery_slot else "")

        consumer_name = consumer.name if consumer else "お客様"
        message = f"""{consumer_name}様 ベジコベをご利用いただきありがとうございます。

■ご注文内容
{items_lines}[商品合計] {subtotal_text}
[送料] {shipping_text}（{shipping_label}）
[お支払い合計] {total_text}

■お受け取り
日時：{time_label}
場所：{pickup_place}

※お支払いは【商品受取時に現金】でお願いいたします。
※お釣りが出ないようご協力をお願いいたします。"""

        await self.send_push_message(token, target_user_id, message)

    async def notify_farmers_consumer_order(self, order: ConsumerOrder):
        """Notify farmers about consumer orders (same format as restaurant orders)."""
        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET
        )

        farmers_items: Dict[int, Dict[str, Any]] = {}
        for item in order.order_items:
            product = getattr(item, "product", None)
            farmer = getattr(product, "farmer", None)
            if not farmer or not farmer.line_user_id:
                continue

            farmer_id = farmer.id
            if farmer_id not in farmers_items:
                farmers_items[farmer_id] = {
                    "farmer_name": farmer.name,
                    "line_user_id": farmer.line_user_id,
                    "items": [],
                    "total_sales": Decimal(0)
                }
            farmers_items[farmer_id]["items"].append(item)
            farmers_items[farmer_id]["total_sales"] += Decimal(item.total_amount or 0)

        if not farmers_items:
            return

        delivery_date_str = ""
        if order.delivery_slot and order.delivery_slot.date:
            delivery_date_str = self.format_date(order.delivery_slot.date)
        time_label = order.delivery_time_label or (order.delivery_slot.time_text if order.delivery_slot else "")

        for farmer_id, data in farmers_items.items():
            target_user_id = data["line_user_id"]
            items_text = ""
            for item in data["items"]:
                emoji = "📦"
                if "人参" in item.product_name: emoji = "🥕"
                elif "トマト" in item.product_name: emoji = "🍅"
                elif "ネギ" in item.product_name: emoji = "🥬"

                items_text += f"{emoji} {item.product_name}\n"
                items_text += f"   数量: {item.quantity}{item.product_unit}\n"

            message = f"""【🎉 注文が入りました！】
{data['farmer_name']}さん、お疲れ様です！
一般消費者から注文が入りました。収穫・出荷の準備をお願いします。

■ 受渡予定
{delivery_date_str} {time_label}

■ 収穫リスト
{items_text}------------------------
💰 今回の売上予定: {self.format_currency(data['total_sales'])}
------------------------

お野菜のご準備、よろしくお願いいたします！🚛"""

            await self.send_push_message(token, target_user_id, message)

    async def send_invoice_message(self, order: Order, invoice_url: str):
        """Send invoice PDF link to restaurant"""
        target_user_id = settings.LINE_TEST_USER_ID
        
        # If order.restaurant.line_user_id exists, use it?
        # For safety in this environment, using TEST_USER_ID as primary, 
        # but in production logic:
        if order.restaurant and order.restaurant.line_user_id:
             target_user_id = order.restaurant.line_user_id

        if not target_user_id:
            print("No target user ID for invoice")
            return

        token = await self.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET
        )

        message = f"""【請求書送付のお知らせ】
No. {order.id} の請求書をお送りします。
以下のリンクからダウンロードしてご確認ください。

{invoice_url}

※ このリンクの有効期限はありませんが、お早めに保存してください。"""

        await self.send_push_message(token, target_user_id, message)

    async def send_payment_notice_message(self, farmer_id: int, month_str: str, pdf_url: str, line_user_id: str = None):
        """Send payment notice PDF link to farmer"""
        # If line_user_id is not provided, we can't send.
        target_user_id = line_user_id or settings.LINE_TEST_USER_ID
        
        # If line_user_id is provided, prioritize it.
        # But if it's None (e.g. from previous edit), it might fallback to TEST ID which is not ideal for prod.
        # Strict check:
        if line_user_id:
            target_user_id = line_user_id
        elif not settings.DEBUG: # In production, don't send to test user if real user is missing
             print(f"No LINE user ID for farmer {farmer_id}")
             return

        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET
        )

        message = f"""【支払通知書送付のお知らせ】
{month_str}分の支払通知書をお送りします。
以下のリンクからダウンロードしてご確認ください。

{pdf_url}

※ このリンクの有効期限はありませんが、お早めに保存してください。"""

        await self.send_push_message(token, target_user_id, message)

    async def send_monthly_invoice_message(self, restaurant_id: int, month_str: str, pdf_url: str, line_user_id: str = None):
        """Send monthly invoice PDF link to restaurant"""
        # If line_user_id is not provided, fallback to test user
        target_user_id = line_user_id or settings.LINE_TEST_USER_ID
        
        # Strict check for production
        if line_user_id:
            target_user_id = line_user_id
        elif not settings.DEBUG:
            print(f"No LINE user ID for restaurant {restaurant_id}")
            return

        token = await self.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET
        )

        message = f"""【月次請求書送付のお知らせ】
{month_str}分の月次請求書をお送りします。
以下のリンクからダウンロードしてご確認ください。

{pdf_url}

※ このリンクの有効期限はありませんが、お早めに保存してください。"""

        await self.send_push_message(token, target_user_id, message)

line_service = LineNotificationService()
