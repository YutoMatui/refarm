import os
import sys

# Windows の場合、GTK の DLL パスを明示的に追加 (WeasyPrint 用)
if sys.platform == "win32":
    gtk_path = r"C:\Program Files\GTK3-Runtime Win64\bin"
    if os.path.exists(gtk_path):
        os.add_dll_directory(gtk_path)
    else:
        # 他の一般的なパスも試行
        alt_gtk_path = r"C:\Program Files (x86)\GTK3-Runtime Win64\bin"
        if os.path.exists(alt_gtk_path):
            os.add_dll_directory(alt_gtk_path)

import io
import math
from datetime import datetime
from dateutil.relativedelta import relativedelta
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# テンプレートディレクトリの設定
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def generate_invoice_pdf(order):
    """
    Generate Invoice PDF for the given order.
    Returns bytes of the PDF.
    """
    return _generate_pdf(order, "請求書")

def generate_delivery_slip_pdf(order):
    """
    Generate Delivery Slip PDF for the given order.
    Returns bytes of the PDF.
    """
    return _generate_pdf(order, "納品書")

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
        "client_name": f"{order.restaurant.name} 様 御中",
        "sender_name": sender_info["name"],
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        "sender_reg_num": sender_info.get("reg_num", ""),
        
        "total_amount_incl_tax": total_val,
        
        "subject": "野菜代金",
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
        
        "remarks": "" 
    }
    
    html_content = template.render(context)
    
    # PDF生成
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return pdf_bytes

def generate_farmer_payment_notice_pdf(farmer, total_amount, period_str, details):
    """
    農家向け支払通知書（実質的な請求書控え）を生成
    details: list of dict { "date": "YYYY/MM/DD", "product": "name", "amount": 1000 }
    """
    template = env.get_template('invoice_monthly.html') # Use monthly template as base, or create new one
    
    # Issuer Info (Refarm)
    sender_info = {
        "name": "りふぁーむ",
        "zip": "653-0845",
        "address": "兵庫県神戸市長田区戸崎通 2-8-5",
        "building": "メゾン戸崎通 101",
        "tel": "090-9614-4516",
        "pic": "松井優人",
    }

    # Tax calculation (Simple 8% assumption for now as farmers are likely tax exempt or simplified)
    # Farmers receive "Cost Price".
    # Assuming cost_price is tax inclusive or exclusive depending on contract.
    # Usually farmers are paid without tax separation on the invoice unless registered.
    # Let's treat total_amount as Tax Included for the payout.
    
    # Back calc for display
    price_excl = math.ceil(total_amount / 1.08)
    tax_val = total_amount - price_excl
    subtotal_val = price_excl

    # Convert details to template format
    # Using 'daily_items' structure from monthly invoice template
    # { "date": ..., "description": ..., "amount": ... }
    items = []
    for d in details:
        items.append({
            "date": d["date"],
            "description": d["product"],
            "amount": d["amount"]
        })

    context = {
        "title": "支払通知書",
        "invoice_date": datetime.now().strftime('%Y/%m/%d'),
        "invoice_number": f"P-{farmer.id}-{datetime.now().strftime('%Y%m')}",
        "target_month": "", # Optional
        "period": period_str,
        
        "client_name": f"{farmer.name} 様", # Recipient is Farmer
        "sender_name": sender_info["name"], # Sender is Refarm
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        
        "total_amount_incl_tax": total_amount,
        "subtotal": subtotal_val,
        "tax_amount": tax_val,
        
        "due_date": "翌月末日", # Payment terms
        "bank_name": farmer.bank_name or "（未設定）",
        "bank_branch": farmer.bank_branch or "",
        "bank_type": farmer.bank_account_type or "普通",
        "bank_number": farmer.bank_account_number or "",
        
        "daily_items": items,
        "remarks": "いつも美味しいお野菜をありがとうございます。"
    }
    
    # テンプレートの変数と一致するように修正
    # invoice_monthly.html が daily_items を使用しているのでOK
    # ただし、target_month など一部の変数が空文字だと表示が崩れる可能性があるため調整
    # invoice_monthly.html 側で {% if target_month %} 等のチェックがあればよいが、
    # 既存のテンプレート次第。
    
    html_content = template.render(context)
    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes

def generate_monthly_invoice_pdf(restaurant, orders, target_month_str, invoice_period):
    """
    月次請求書を生成
    """
    template = env.get_template('invoice_monthly.html')
    
    # 1. Aggregate by Delivery Date
    # Structure: { date: { 'subtotal': 0, 'tax8': 0, 'tax10': 0, 'total': 0 } }
    daily_summary = {}
    
    total_subtotal = 0
    total_tax = 0
    grand_total = 0
    
    # For tax breakdown (if needed strictly per invoice, usually calculated on total)
    # But prompt asks for "Daily Amounts". 
    # Let's aggregate Order totals per day.
    
    for order in orders:
        d_date = order.delivery_date.strftime('%Y/%m/%d')
        if d_date not in daily_summary:
            daily_summary[d_date] = 0
        
        # Add order total (tax included) to daily total
        daily_summary[d_date] += int(order.total_amount)
        
        # Accumulate grand totals
        grand_total += int(order.total_amount)
        
        # Approximate tax back-calculation for summary if data missing
        # Assuming 8% for everything for simplicity unless detailed
        # (Strict invoice needs per-item tax accumulation)
        # Using order.tax_amount if available
        t_tax = int(order.tax_amount or 0)
        if t_tax == 0 and int(order.total_amount) > 0:
             # Fallback
             price_excl = math.ceil(int(order.total_amount) / 1.08)
             t_tax = int(order.total_amount) - price_excl
        
        total_tax += t_tax
    
    total_subtotal = grand_total - total_tax

    # Sort by date
    sorted_days = sorted(daily_summary.items()) # list of (date, amount)
    
    # Convert to list for template
    items = []
    for date_str, amount in sorted_days:
        items.append({
            "date": date_str,
            "description": "野菜仕入代金", # Generic description
            "amount": amount
        })

    # Issuer Info (Same as single invoice)
    sender_info = {
        "name": "りふぁーむ",
        "zip": "653-0845",
        "address": "兵庫県神戸市長田区戸崎通2-8-5",
        "building": "メゾン戸崎通101",
        "tel": "090-9614-4516",
        "pic": "松井優人",
        # "reg_num": "T1234567890123" # Dummy Invoice Registration Number (Commented out - not yet registered)
    }

    bank_info = {
        "name": "三井住友銀行",
        "branch": "板宿支店",
        "type": "普通",
        "number": "4792089"
    }
    
    # Calculate Due Date (End of next month from target month)
    # Assuming target_month_str is like "2025-12"
    # Logic: If invoice is for Dec, due is End of Jan.
    # Simplified: Today + 1 month roughly
    now = datetime.now()
    payment_deadline = now + relativedelta(months=1)
    payment_deadline = payment_deadline.replace(day=1) + relativedelta(months=1, days=-1)
    due_date = payment_deadline.strftime('%Y/%m/%d')

    context = {
        "title": "請求書 (月次)",
        "invoice_date": datetime.now().strftime('%Y/%m/%d'),
        "invoice_number": f"M-{restaurant.id}-{datetime.now().strftime('%Y%m')}", # Dummy ID
        "target_month": target_month_str,
        "period": invoice_period,
        
        "client_name": f"{restaurant.name} 様 御中",
        "sender_name": sender_info["name"],
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        "sender_reg_num": sender_info.get("reg_num", ""),
        
        "total_amount_incl_tax": grand_total,
        "subtotal": total_subtotal,
        "tax_amount": total_tax,
        
        "due_date": due_date,
        "bank_name": bank_info["name"],
        "bank_branch": bank_info["branch"],
        "bank_type": bank_info["type"],
        "bank_number": bank_info["number"],
        
        "daily_items": items,
        "remarks": "毎度ありがとうございます。"
    }
    
    html_content = template.render(context)
    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes
