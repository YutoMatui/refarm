import httpx
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from typing import Dict, List, Any
from app.core.config import settings
from app.models import Order, OrderItem, ConsumerOrder, Farmer, Product
from app.models.enums import DeliverySlotType

class LineNotificationService:
    BASE_URL = "https://api.line.me"
    
    def __init__(self):
        # Cache for tokens: { "channel_id": {"token": str, "expires_at": datetime} }
        self._tokens = {}
        
    async def get_access_token(self, channel_id: str, channel_secret: str, long_lived_token: str = None) -> str:
        """
        Get Channel Access Token
        If long_lived_token is provided, use it directly.
        Otherwise, issue a short-lived token using channel credentials and cache it.
        """
        # Prioritize long-lived token if provided
        if long_lived_token:
            return long_lived_token
        
        if not channel_id or not channel_secret:
            print(f"Missing channel credentials for {channel_id}")
            return None

        # Check in-memory cache
        now = datetime.now()
        if channel_id in self._tokens:
            cache = self._tokens[channel_id]
            # Use cached token if it has more than 5 minutes before expiration
            if cache["expires_at"] > now:
                return cache["token"]

        # LINE Messaging API v2.1 token issuance
        async with httpx.AsyncClient() as client:
            payload = {
                "grant_type": "client_credentials",
                "client_id": channel_id,
                "client_secret": channel_secret
            }
            try:
                # Use v2.1 endpoint: /v2/oauth/accessToken
                response = await client.post(
                    f"{self.BASE_URL}/v2/oauth/accessToken",
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code != 200:
                    print(f"LINE Token Error: {response.status_code} - {response.text}")
                    return None
                
                data = response.json()
                token = data.get("access_token")
                expires_in = data.get("expires_in", 0) # seconds
                
                if not token:
                    print(f"No access token in response for {channel_id}: {data}")
                    return None
                
                # Cache the token with expiration (buffer 5 minutes)
                self._tokens[channel_id] = {
                    "token": token,
                    "expires_at": now + (timedelta(seconds=expires_in - 300) if expires_in > 300 else timedelta(seconds=expires_in))
                }
                
                print(f"Successfully issued new LINE token for channel {channel_id}")
                return token
            except Exception as e:
                print(f"Exception while getting LINE token for {channel_id}: {e}")
                return None

    async def send_push_message(self, token: str, to_user_id: str, text: str):
        """Send a push message"""
        if not token:
            print("No access token available, skipping LINE notification")
            return
            
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
                print(f"Failed to send LINE message: {response.status_code} - {response.text}")

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

    def _get_admin_user_ids(self) -> List[str]:
        raw = (settings.LINE_ADMIN_USER_IDS or "").strip()
        if raw:
            return [value.strip() for value in raw.split(",") if value.strip()]
        # フォールバック: LINE_TEST_USER_ID を管理者として使用
        if settings.LINE_TEST_USER_ID:
            return [settings.LINE_TEST_USER_ID]
        return []

    def _get_admin_token_params(self):
        """管理者チャネルの認証情報を返す。未設定なら飲食店チャネルにフォールバック"""
        if settings.LINE_ADMIN_CHANNEL_ID and (settings.LINE_ADMIN_CHANNEL_SECRET or settings.LINE_ADMIN_CHANNEL_ACCESS_TOKEN):
            return (settings.LINE_ADMIN_CHANNEL_ID, settings.LINE_ADMIN_CHANNEL_SECRET, settings.LINE_ADMIN_CHANNEL_ACCESS_TOKEN)
        return (settings.LINE_RESTAURANT_CHANNEL_ID, settings.LINE_RESTAURANT_CHANNEL_SECRET, settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN)

    async def notify_admin_order(self, order: Order):
        """Send order notification to admin LINE."""
        admin_user_ids = self._get_admin_user_ids()
        if not admin_user_ids:
            print("No LINE admin user IDs configured")
            return

        channel_id, channel_secret, channel_token = self._get_admin_token_params()
        token = await self.get_access_token(channel_id, channel_secret, channel_token)

        restaurant_name = order.restaurant.name if order.restaurant else f"Restaurant #{order.restaurant_id}"
        delivery_date_str = self.format_date(order.delivery_date)
        delivery_time = self.format_time_slot(
            order.delivery_time_slot.value if hasattr(order.delivery_time_slot, 'value') else str(order.delivery_time_slot)
        )

        items_text = ""
        for item in order.order_items:
            farmer_name = "農家不明"
            if item.product and getattr(item.product, "farmer", None) and item.product.farmer.name:
                farmer_name = item.product.farmer.name
            items_text += f"・{item.product_name}（{farmer_name}） × {item.quantity}{item.product_unit}\n"
        if not items_text:
            items_text = "・（商品情報が取得できませんでした）\n"

        message = f"""【管理通知】新規注文（飲食店）
注文番号: {order.id}
飲食店: {restaurant_name}
配送予定: {delivery_date_str} {delivery_time}

ご注文内容:
{items_text}合計: {self.format_currency(order.total_amount)}"""

        for user_id in admin_user_ids:
            await self.send_push_message(token, user_id, message)

    async def notify_admin_consumer_order(self, order: ConsumerOrder):
        """Send consumer order notification to admin LINE."""
        admin_user_ids = self._get_admin_user_ids()
        if not admin_user_ids:
            print("No LINE admin user IDs configured")
            return

        channel_id, channel_secret, channel_token = self._get_admin_token_params()
        token = await self.get_access_token(channel_id, channel_secret, channel_token)

        consumer_name = "お客様"
        if getattr(order, "consumer", None) and order.consumer.name:
            consumer_name = order.consumer.name

        items_text = ""
        for item in order.order_items:
            farmer_name = "農家不明"
            if item.product and getattr(item.product, "farmer", None) and item.product.farmer.name:
                farmer_name = item.product.farmer.name
            items_text += f"・{item.product_name}（{farmer_name}） × {item.quantity}{item.product_unit}\n"
        if not items_text:
            items_text = "・（商品情報が取得できませんでした）\n"

        delivery_date_str = ""
        if order.delivery_slot and order.delivery_slot.date:
            delivery_date_str = self.format_date(order.delivery_slot.date)
        time_label = order.delivery_time_label or (order.delivery_slot.time_text if order.delivery_slot else "")

        message = f"""【管理通知】新規注文（消費者）
注文番号: {order.id}
注文者: {consumer_name}
受取予定: {delivery_date_str} {time_label}

ご注文内容:
{items_text}合計: {self.format_currency(order.total_amount)}"""

        for user_id in admin_user_ids:
            await self.send_push_message(token, user_id, message)

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
            settings.LINE_RESTAURANT_CHANNEL_SECRET,
            settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
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
ベジコベをご利用いただきありがとうございます。
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
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
        )

        if not token:
            print("Failed to get producer channel access token")
            return

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
            farmers_items[farmer_id]["total_sales"] += (item.wholesale_price or 0) * item.quantity

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
{delivery_date_str} 午前10時まで

■ 収穫リスト
{items_text}
------------------------
💰 今回の売上予定: {self.format_currency(data["total_sales"])}
------------------------

お野菜のご準備、よろしくお願いいたします！🚛"""

            await self.send_push_message(token, target_user_id, message)

    async def notify_farmers_order_cancelled(self, order: Order):
        """Notify farmers when an order is cancelled."""
        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
        )

        if not token:
            return

        farmers_items: Dict[int, Dict[str, Any]] = {}
        for item in order.order_items:
            if not item.product or not item.product.farmer:
                continue

            farmer = item.product.farmer
            if not farmer.line_user_id:
                continue

            farmer_id = farmer.id
            if farmer_id not in farmers_items:
                farmers_items[farmer_id] = {
                    "farmer_name": farmer.name,
                    "line_user_id": farmer.line_user_id,
                    "items": [],
                }
            farmers_items[farmer_id]["items"].append(item)

        if not farmers_items:
            return

        restaurant_name = order.restaurant.name if order.restaurant else f"Restaurant #{order.restaurant_id}"
        delivery_date_str = self.format_date(order.delivery_date)
        delivery_time = self.format_time_slot(
            order.delivery_time_slot.value if hasattr(order.delivery_time_slot, 'value') else str(order.delivery_time_slot)
        )

        for farmer_id, data in farmers_items.items():
            items_text = ""
            for item in data["items"]:
                items_text += f"・{item.product_name} × {item.quantity}{item.product_unit}\n"

            message = f"""【注文キャンセルのお知らせ】
{data['farmer_name']}さん
飲食店からの注文がキャンセルされました。

注文番号: {order.id}
飲食店: {restaurant_name}
配送予定: {delivery_date_str} {delivery_time}

キャンセル内容:
{items_text}"""

            await self.send_push_message(token, data["line_user_id"], message)

    async def notify_admin_order_cancelled(self, order: Order):
        """Send cancellation notification to admin LINE."""
        admin_user_ids = self._get_admin_user_ids()
        if not admin_user_ids:
            print("No LINE admin user IDs configured")
            return

        token = await self.get_access_token(
            settings.LINE_ADMIN_CHANNEL_ID,
            settings.LINE_ADMIN_CHANNEL_SECRET,
            settings.LINE_ADMIN_CHANNEL_ACCESS_TOKEN
        )

        restaurant_name = order.restaurant.name if order.restaurant else f"Restaurant #{order.restaurant_id}"
        delivery_date_str = self.format_date(order.delivery_date)
        delivery_time = self.format_time_slot(
            order.delivery_time_slot.value if hasattr(order.delivery_time_slot, 'value') else str(order.delivery_time_slot)
        )

        items_text = ""
        for item in order.order_items:
            farmer_name = "農家不明"
            if item.product and getattr(item.product, "farmer", None) and item.product.farmer.name:
                farmer_name = item.product.farmer.name
            items_text += f"・{item.product_name}（{farmer_name}） × {item.quantity}{item.product_unit}\n"
        if not items_text:
            items_text = "・（商品情報が取得できませんでした）\n"

        message = f"""【管理通知】注文キャンセル
注文番号: {order.id}
飲食店: {restaurant_name}
配送予定: {delivery_date_str} {delivery_time}

キャンセル内容:
{items_text}"""

        for user_id in admin_user_ids:
            await self.send_push_message(token, user_id, message)

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

        # 消費者向けチャンネルを使用
        consumer_channel_id = getattr(settings, 'LINE_CONSUMER_CHANNEL_ID', None)
        consumer_access_token = getattr(settings, 'LINE_CONSUMER_ACCESS_TOKEN', None)
        
        # 消費者チャンネルが設定されていない場合は飲食店チャンネルをフォールバック
        if not consumer_channel_id or not consumer_access_token:
            print("Consumer channel not configured, using restaurant channel as fallback")
            consumer_channel_id = settings.LINE_RESTAURANT_CHANNEL_ID
            consumer_access_token = settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
        
        token = await self.get_access_token(
            consumer_channel_id,
            getattr(settings, 'LINE_CONSUMER_CHANNEL_SECRET', ""),
            consumer_access_token
        )
        
        if not token:
            print("Failed to get consumer channel access token")
            return

        items_lines = ""
        for item in order.order_items:
            items_lines += f"・{item.product_name} × {item.quantity}\n"
        if not items_lines:
            items_lines = "・商品情報が取得できませんでした\n"

        # 金額の計算（税抜き小計、消費税、税込み合計）
        subtotal_text = self.format_currency_plain(order.subtotal)
        tax_text = self.format_currency_plain(order.tax_amount)
        product_total = order.subtotal + order.tax_amount
        product_total_text = self.format_currency_plain(product_total)
        
        shipping_label = order.delivery_label or "受取"
        shipping_text = self.format_currency_plain(order.shipping_fee)
        total_text = self.format_currency_plain(order.total_amount)

        pickup_place = "ユニバードーム付近" if order.delivery_type == DeliverySlotType.UNIVERSITY else shipping_label
        time_label = order.delivery_time_label or (order.delivery_slot.time_text if order.delivery_slot else "")

        consumer_name = consumer.name if consumer else "お客様"
        
        # 学校受け取りの場合は住所表示を省略
        location_info = ""
        if order.delivery_type == DeliverySlotType.HOME and order.delivery_address:
            location_info = f"住所：{order.delivery_address}\n"
        
        message = f"""{consumer_name}様 ベジコベをご利用いただきありがとうございます。

■ご注文内容
{items_lines}
[小計（税抜）] {subtotal_text}
[消費税] {tax_text}
[商品合計（税込）] {product_total_text}
[送料] {shipping_text}（{shipping_label}）
━━━━━━━━━━━━━━
[お支払い合計] {total_text}

■お受け取り
日時：{time_label}
場所：{pickup_place}
{location_info}
※お支払いはクレジットカードで決済済みです。"""

        await self.send_push_message(token, target_user_id, message)

    async def notify_farmers_consumer_order(self, order: ConsumerOrder):
        """Notify farmers about consumer orders (same format as restaurant orders)."""
        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
        )

        if not token:
            print("Failed to get producer channel access token for consumer order")
            return

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
            # 仕入れ値（農家手取り）で売上を計算
            cost_price = Decimal(str(product.cost_price or 0)) if product and product.cost_price else Decimal(0)
            farmers_items[farmer_id]["total_sales"] += cost_price * item.quantity

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
注文が入りました。収穫・出荷の準備をお願いします。

■ 受渡予定
{delivery_date_str} {time_label}

■ 収穫リスト
{items_text}------------------------
💰 今回の売上予定: {self.format_currency(data['total_sales'])}
------------------------

お野菜のご準備、よろしくお願いいたします！🚛"""

            await self.send_push_message(token, target_user_id, message)

    async def notify_consumer_order_cancelled(self, order: ConsumerOrder):
        """消費者にキャンセル通知を送信"""
        consumer = getattr(order, "consumer", None)
        if not consumer or not consumer.line_user_id:
            return

        consumer_channel_id = getattr(settings, 'LINE_CONSUMER_CHANNEL_ID', None)
        consumer_access_token = getattr(settings, 'LINE_CONSUMER_ACCESS_TOKEN', None)
        if not consumer_channel_id or not consumer_access_token:
            consumer_channel_id = settings.LINE_RESTAURANT_CHANNEL_ID
            consumer_access_token = settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN

        token = await self.get_access_token(
            consumer_channel_id,
            getattr(settings, 'LINE_CONSUMER_CHANNEL_SECRET', ""),
            consumer_access_token,
        )
        if not token:
            return

        consumer_name = consumer.name or "お客様"
        total_text = self.format_currency_plain(order.total_amount)

        message = f"""{consumer_name}様
ご注文（注文番号: {order.id}）がキャンセルされました。

お支払い済みの金額（{total_text}）は返金処理を行いました。カード会社の処理状況により、返金の反映まで数日かかる場合がございます。

ご不明点がございましたら、公式LINEよりお問い合わせください。"""

        await self.send_push_message(token, consumer.line_user_id, message)

    async def notify_farmers_consumer_order_cancelled(self, order: ConsumerOrder):
        """農家にキャンセル通知を送信"""
        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN,
        )
        if not token:
            return

        for item in order.order_items:
            product = getattr(item, "product", None)
            farmer = getattr(product, "farmer", None) if product else None
            if not farmer or not farmer.line_user_id:
                continue

            message = f"""【注文キャンセルのお知らせ】
{farmer.name}さん
注文がキャンセルされました。

注文番号: {order.id}
キャンセル内容:
・{item.product_name} × {item.quantity}{item.product_unit}

出荷準備をされていた場合はお手数ですがご確認ください。"""

            await self.send_push_message(token, farmer.line_user_id, message)

    async def notify_admin_consumer_order_cancelled(self, order: ConsumerOrder):
        """管理者にキャンセル通知を送信"""
        admin_user_ids = self._get_admin_user_ids()
        if not admin_user_ids:
            return

        channel_id, channel_secret, channel_token = self._get_admin_token_params()
        token = await self.get_access_token(channel_id, channel_secret, channel_token)
        if not token:
            return

        consumer_name = "お客様"
        if getattr(order, "consumer", None) and order.consumer.name:
            consumer_name = order.consumer.name

        items_text = ""
        for item in order.order_items:
            farmer_name = "農家不明"
            if item.product and getattr(item.product, "farmer", None) and item.product.farmer.name:
                farmer_name = item.product.farmer.name
            items_text += f"・{item.product_name}（{farmer_name}） × {item.quantity}{item.product_unit}\n"
        if not items_text:
            items_text = "・（商品情報が取得できませんでした）\n"

        message = f"""【管理通知】注文キャンセル（消費者）
注文番号: {order.id}
注文者: {consumer_name}
合計: {self.format_currency(order.total_amount)}

キャンセル内容:
{items_text}"""

        for user_id in admin_user_ids:
            await self.send_push_message(token, user_id, message)

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
            settings.LINE_RESTAURANT_CHANNEL_SECRET,
            settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
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
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
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
            settings.LINE_RESTAURANT_CHANNEL_SECRET,
            settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
        )

        month_label = f"{month_str}分"
        due_month_label = month_str
        try:
            dt = datetime.strptime(month_str, "%Y-%m")
            month_label = f"{dt.month}月分"
            due_month_label = f"{(dt + relativedelta(months=1)).month}月"
        except Exception:
            pass

        message = f"""いつもベジコベをご利用いただきありがとうございます。
{month_label}のご利用代金についての請求書を送付いたしました。

恐れ入りますが、内容をご確認いただき、{due_month_label}15日までにお振込みをお願いいたします。
※金額の詳細や内訳につきましては、アプリ内の注文履歴、または別途お送りしている請求書データをご確認ください。

請求書PDF：
{pdf_url}"""

        await self.send_push_message(token, target_user_id, message)

    async def send_delivery_slip_message(self, order: Order, slip_url: str):
        """Send delivery slip PDF link to restaurant"""
        target_user_id = None
        if order.restaurant and order.restaurant.line_user_id:
             target_user_id = order.restaurant.line_user_id
        
        if not target_user_id:
            target_user_id = settings.LINE_TEST_USER_ID

        if not target_user_id:
            print(f"No target user ID for delivery slip {order.id}")
            return

        token = await self.get_access_token(
            settings.LINE_RESTAURANT_CHANNEL_ID,
            settings.LINE_RESTAURANT_CHANNEL_SECRET,
            settings.LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN
        )

        message = f"""【納品書送付のお知らせ】
No. {order.id} の納品書をお送りします。
以下のリンクからダウンロードしてご確認ください。

{slip_url}

※ このリンクの有効期限はありませんが、お早めに保存してください。"""

        await self.send_push_message(token, target_user_id, message)

    async def notify_admin_product_updated(self, farmer_name: str, product_name: str, action: str = "更新"):
        """農家が商品を更新/登録した時に管理者へLINE通知"""
        admin_user_ids = self._get_admin_user_ids()
        if not admin_user_ids:
            print("No LINE admin user IDs configured, skipping product update notification")
            return

        channel_id, channel_secret, channel_token = self._get_admin_token_params()
        token = await self.get_access_token(channel_id, channel_secret, channel_token)

        now = datetime.now(ZoneInfo(settings.TZ))
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        time_str = f"{now.month}月{now.day}日({weekdays[now.weekday()]}) {now.hour:02d}:{now.minute:02d}"

        message = f"""【管理通知】商品{action}
{farmer_name}さんが商品を{action}しました。

■ 商品名: {product_name}
■ 日時: {time_str}"""

        for user_id in admin_user_ids:
            await self.send_push_message(token, user_id, message)

    async def notify_farmer_procurement_order(self, farmer, items, delivery_slot=None):
        """仕入れ集計に基づく農家への一括発注通知"""
        if not farmer.line_user_id:
            print(f"Farmer {farmer.id} has no LINE user ID, skipping procurement notification")
            return

        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN,
        )
        if not token:
            print("Failed to get producer channel token for procurement notification")
            return

        delivery_info = ""
        if delivery_slot and delivery_slot.date:
            delivery_info = f"■ 出荷期限\n{self.format_date(delivery_slot.date)} 午前10時まで\n\n"

        items_text = ""
        total_cost = 0
        for item in items:
            sp = item.source_product
            product_name = sp.name if sp else "不明"
            unit = sp.unit if sp else ""
            qty = item.ordered_farmer_qty
            items_text += f"📦 {product_name}\n   数量: {qty}{unit}\n"
            if item.unit_cost:
                cost = int(item.unit_cost) * qty
                total_cost += cost

        message = f"""【🎉 発注のお知らせ】
{farmer.name}さん、お疲れ様です！
以下の出荷をお願いいたします。

{delivery_info}■ 出荷リスト
{items_text}
------------------------
💰 今回の売上予定: {self.format_currency(total_cost)}
------------------------

お野菜のご準備、よろしくお願いいたします！🚛"""

        await self.send_push_message(token, farmer.line_user_id, message)

    async def notify_farmer_item_deleted(self, order: Order, item: OrderItem):
        """注文明細が削除されたことを農家に通知"""
        # Ensure farmer info is available
        target_user_id = None
        
        # We need the farmer's LINE ID. 
        # The item might have product.farmer loaded, or we use item.product_id to find it.
        farmer = None
        if hasattr(item, 'product') and item.product and item.product.farmer:
            farmer = item.product.farmer
        
        if farmer and farmer.line_user_id:
            target_user_id = farmer.line_user_id
        
        if not target_user_id:
            print(f"No LINE user ID for farmer of item {item.id}")
            return

        token = await self.get_access_token(
            settings.LINE_PRODUCER_CHANNEL_ID,
            settings.LINE_PRODUCER_CHANNEL_SECRET,
            settings.LINE_PRODUCER_CHANNEL_ACCESS_TOKEN
        )

        delivery_date_str = self.format_date(order.delivery_date)
        
        message = f"""【注文内容の変更（削除）のお知らせ】
以下の日時の配送予定分から、商品が削除されました。

■注文番号: {order.id}
■配送日: {delivery_date_str}
■削除された商品: {item.product_name}
■数量: {item.quantity} {item.product_unit}

※欠品対応等による削除です。在庫の調整をご確認ください。"""

        await self.send_push_message(token, target_user_id, message)


line_service = LineNotificationService()
