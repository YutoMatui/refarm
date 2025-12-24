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
    
    # 注文明細
    items = []
    # order.order_items が SQLAlchemy のリレーション等でイテラブルであると仮定
    for item in order.order_items:
        items.append({
            "name": item.product_name,
            "quantity": item.quantity,
            "unit": item.product_unit,
            "unit_price": int(item.unit_price),
            "amount": int(item.subtotal)
        })

    # 合計金額 (税込)
    # order.total_amount を正とする
    total_val = int(order.total_amount)
    
    # 消費税計算 (バック計算)
    # 税率8%と仮定して、合計金額から税額を割り出す
    # 本体価格 = 合計 / 1.08
    # 消費税 = 合計 - 本体価格
    # B2Bの場合、端数処理などがあるが、ここでは簡易的にバック計算で税額を表示する
    tax_val = int(order.tax_amount)
    if tax_val == 0:
        # DBに税額が入っていない場合、合計金額から割り戻す (切り捨て)
        price_excl_tax = math.ceil(total_val / 1.08)
        tax_val = total_val - price_excl_tax
        subtotal_val = price_excl_tax
    else:
        # DBに税額がある場合
        subtotal_val = total_val - tax_val
    
    # 発行元情報
    sender_info = {
        "name": "りふぁーむ",
        "zip": "653-0845",
        "address": "兵庫県神戸市長田区戸崎通 2-8-5",
        "building": "メゾン戸崎通 101",
        "tel": "090-9614-4516",
        "pic": "松井優人"
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
        "client_name": order.restaurant.name,
        "sender_name": sender_info["name"],
        "sender_zip": sender_info["zip"],
        "sender_address": sender_info["address"],
        "sender_building": sender_info["building"],
        "sender_tel": sender_info["tel"],
        "sender_pic": sender_info["pic"],
        
        "total_amount_incl_tax": total_val,
        
        "subject": "野菜代金",
        "due_date": due_date,
        "bank_name": bank_info.get("name", ""),
        "bank_branch": bank_info.get("branch", ""),
        "bank_type": bank_info.get("type", ""),
        "bank_number": bank_info.get("number", ""),
        
        "items": items,
        "subtotal": subtotal_val,
        "tax_amount": tax_val,
        "remarks": "" 
    }
    
    html_content = template.render(context)
    
    # PDF生成
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return pdf_bytes
