import os
import math
from datetime import datetime
from dateutil.relativedelta import relativedelta
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# Setup Jinja2 Environment
template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
env = Environment(loader=FileSystemLoader(template_dir))

def _generate_pdf(order, title):
    template = env.get_template('invoice.html')
    
    # 日付
    invoice_date = order.created_at or datetime.now()
    if order.confirmed_at:
        invoice_date = order.confirmed_at
    
    # 支払期限（請求書の場合のみ）
    due_date = "-"
    if title == "請求書":
        payment_deadline = invoice_date + relativedelta(months=1)
        payment_deadline = payment_deadline.replace(day=1) + relativedelta(months=1, days=-1) # End of next month
        due_date = payment_deadline.strftime('%Y/%m/%d')
    
    # Tax Aggregation
    total_8_percent_subtotal = 0
    total_8_percent_tax = 0
    total_10_percent_subtotal = 0
    total_10_percent_tax = 0

    # 注文明細
    items = []
    # order.order_items が SQLAlchemy のリレーション等でイテラブルであると仮定
    for item in order.order_items:
        rate = int(item.tax_rate)
        subtotal = int(item.subtotal)
        tax = int(item.tax_amount)
        
        items.append({
            "name": item.product_name,
            "quantity": item.quantity,
            "unit": item.product_unit,
            "unit_price": int(item.unit_price),
            "amount": subtotal,
            "tax_rate": rate  # Add tax rate for display if needed
        })
        
        if rate == 8:
            total_8_percent_subtotal += subtotal
            total_8_percent_tax += tax
        elif rate == 10:
            total_10_percent_subtotal += subtotal
            total_10_percent_tax += tax
        else:
            # Fallback or other rates, treat as 10? or just add to total without tax breakdown specific?
            # For now assume only 8 and 10 exist.
            total_10_percent_subtotal += subtotal
            total_10_percent_tax += tax

    # 配送料があれば追加 (標準税率 10%)
    shipping_fee = getattr(order, 'shipping_fee', 0) or 0
    if shipping_fee > 0:
        # 配送料の税抜金額を計算（簡易的に1.1で割る）
        shipping_base = math.ceil(shipping_fee / 1.1)
        shipping_tax = shipping_fee - shipping_base
        
        items.append({
            "name": "配送料",
            "quantity": 1,
            "unit": "式",
            "unit_price": shipping_base,
            "amount": shipping_base,
            "tax_rate": 10
        })
        
        total_10_percent_subtotal += shipping_base
        total_10_percent_tax += shipping_tax

    # 合計金額 (税込)
    # Re-calculate to match the sum of breakdowns (to avoid rounding diffs with DB total)
    # But usually order.total_amount is the source of truth.
    # Ideally: order.total_amount should equal (subtotal8+tax8 + subtotal10+tax10)
    total_val = int(order.total_amount)
    
    # Grand totals for display
    grand_subtotal = total_8_percent_subtotal + total_10_percent_subtotal
    grand_tax = total_8_percent_tax + total_10_percent_tax
    
    # 発行元情報
    sender_info = {
        "name": "りふぁーむ",
        "zip": "653-0845",
        "address": "兵庫県神戸市長田区戸崎通 2-8-5",
        "building": "メゾン戸崎通 101",
        "tel": "090-9614-4516",
        "pic": "松井優人",
        "reg_num": "T1234567890123" # Dummy T-Number (Enable when real)
    }

    # 銀行振込先
    bank_info = {
        "name": "三井住友銀行",
        "branch": "板宿支店",
        "type": "普通",
        "number": "4792089"
    }
    if title != "請求書":
        bank_info = {k: "" for k in bank_info}

    context = {
        "title": title,
        "invoice_date": invoice_date.strftime('%Y/%m/%d'),
        "invoice_number": f"{1000 + order.id}",
        "client_name": f"{order.restaurant.name} 様",
        "sender_name": sender_info["name"],
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        "sender_reg_num": sender_info.get("reg_num", ""),
        "subject": "野菜代金として",
        
        "total_amount_incl_tax": total_val,
        
        "due_date": due_date,
        "bank_name": bank_info.get("name", ""),
        "bank_branch": bank_info.get("branch", ""),
        "bank_type": bank_info.get("type", ""),
        "bank_number": bank_info.get("number", ""),
        
        "items": items,
        
        # New Breakdown Fields
        "subtotal": grand_subtotal,
        "tax_amount": grand_tax,
        
        "total_8_percent_subtotal": total_8_percent_subtotal,
        "total_8_percent_tax": total_8_percent_tax,
        "total_10_percent_subtotal": total_10_percent_subtotal,
        "total_10_percent_tax": total_10_percent_tax,
        
        "remarks": "※振込手数料は貴社負担にてお願い致します。" if title == "請求書" else ""
    }
    
    html_content = template.render(context)
    
    # PDF生成
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return pdf_bytes

def generate_invoice_pdf(order):
    return _generate_pdf(order, "請求書")

def generate_delivery_slip_pdf(order):
    return _generate_pdf(order, "納品書")

def generate_monthly_invoice_pdf(restaurant, orders, target_month_label, period_str):
    template = env.get_template('invoice_monthly.html')
    
    # Common Data
    invoice_date = datetime.now()
    # Calculate totals
    grand_total = 0
    grand_subtotal = 0
    grand_tax = 0
    
    # Daily Items Aggregation? 
    # The template expects `daily_items` with date, description, amount.
    daily_items = []
    
    # Sort orders by date
    sorted_orders = sorted(orders, key=lambda x: x.delivery_date)
    
    for order in sorted_orders:
        date_str = datetime.strptime(str(order.delivery_date), '%Y-%m-%d').strftime('%m/%d')
        desc = "野菜代金" # Could be more specific if needed
        amount = int(order.total_amount)
        
        daily_items.append({
            "date": date_str,
            "description": desc,
            "amount": amount
        })
        
        grand_total += amount
        grand_subtotal += int(order.subtotal)
        grand_tax += int(order.tax_amount)
        
        # Note: If shipping fee is separate in order.total_amount, we should ensure it's captured.
        # order.total_amount includes subtotal + tax + shipping.
        # order.subtotal is just items.
        # order.tax_amount is tax.
        # So grand_subtotal might need to include shipping base?
        # For simplicity, we trust the order totals.

    # 支払期限
    payment_deadline = invoice_date + relativedelta(months=1)
    payment_deadline = payment_deadline.replace(day=1) + relativedelta(months=1, days=-1)
    due_date = payment_deadline.strftime('%Y/%m/%d')

    # 発行元情報 (Duplicate code, should refactor ideally)
    sender_info = {
        "name": "りふぁーむ",
        "zip": "653-0845",
        "address": "兵庫県神戸市長田区戸崎通 2-8-5",
        "building": "メゾン戸崎通 101",
        "tel": "090-9614-4516",
        "pic": "松井優人",
        "reg_num": "T1234567890123"
    }

    bank_info = {
        "name": "三井住友銀行",
        "branch": "板宿支店",
        "type": "普通",
        "number": "4792089"
    }

    context = {
        "title": "請求書",
        "invoice_date": invoice_date.strftime('%Y/%m/%d'),
        "invoice_number": f"M-{restaurant.id}-{datetime.now().strftime('%Y%m')}",
        "client_name": f"{restaurant.name} 様 御中",
        "target_month": target_month_label,
        "period": period_str,
        
        "sender_name": sender_info["name"],
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        "sender_reg_num": sender_info.get("reg_num", ""),
        
        "total_amount_incl_tax": grand_total,
        "subtotal": grand_subtotal,
        "tax_amount": grand_tax,
        
        "due_date": due_date,
        "bank_name": bank_info["name"],
        "bank_branch": bank_info["branch"],
        "bank_type": bank_info["type"],
        "bank_number": bank_info["number"],
        
        "daily_items": daily_items
    }
    
    html_content = template.render(context)
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return pdf_bytes
