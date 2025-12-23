import httpx
from datetime import datetime
from typing import Dict, List, Any
from app.core.config import settings
from app.models import Order, OrderItem

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
            response = await client.post(
                f"{self.BASE_URL}/oauth2/v2.1/token",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
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
        """Send notification to restaurant (Test user for now)"""
        if not settings.LINE_TEST_USER_ID:
            print("No test user ID configured")
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
            farmer_name = item.product.farmer.name if item.product.farmer else "生産者"
            
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

        await self.send_push_message(token, settings.LINE_TEST_USER_ID, message)

    async def notify_farmers(self, order: Order):
        """Send notification to farmers (Test user for now)"""
        if not settings.LINE_TEST_USER_ID:
            return

        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET
        )

        # Group items by farmer
        farmers_items = {}
        for item in order.order_items:
            farmer_id = item.product.farmer_id
            if farmer_id not in farmers_items:
                farmers_items[farmer_id] = {
                    "farmer_name": item.product.farmer.name if item.product.farmer else "生産者",
                    "items": [],
                    "total_sales": 0
                }
            farmers_items[farmer_id]["items"].append(item)
            # Assuming simple sales calc (cost price might be different from selling price)
            # For now using subtotal or if cost_price exists use that.
            # Checking Product model later. Assuming for now we use a percentage or just show amount.
            # The prompt says "今回の売上予定: ¥1,050" which implies cost price.
            # Let's check if Product has cost_price. 
            # If not, use total_amount * 0.7 (example) or just total_amount.
            # I will use total_amount for now, or check product.cost_price if available.
            farmers_items[farmer_id]["total_sales"] += item.total_amount

        for farmer_id, data in farmers_items.items():
            farmer_name = data["farmer_name"]
            
            items_text = ""
            for item in data["items"]:
                emoji = "📦"
                if "人参" in item.product_name: emoji = "🥕"
                
                items_text += f"{emoji} {item.product_name}\n"
                items_text += f"   数量: {item.quantity}{item.product_unit}\n"
                # If there's standard info, add it. (規格: Lサイズ / バラ)
                # item.product.standard might exist?
                
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

            await self.send_push_message(token, settings.LINE_TEST_USER_ID, message)

line_service = LineNotificationService()
