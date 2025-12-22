import os
import io
from datetime import datetime
from dateutil.relativedelta import relativedelta
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# テンプレートディレクトリの設定
# このファイルは api/app/services/invoice.py
# テンプレートは api/app/templates/invoice.html
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

    # 合計計算
    # 既存コードでは order.total_amount を使用していた。
    # 明細の合計と order.total_amount が一致するかはデータ次第だが、
    # ここでは明細の積み上げを小計とする。
    subtotal_val = sum(item["amount"] for item in items)
    
    # 消費税
    # データ構造に税情報が見当たらないため、一旦 0円 (内税想定) とする
    # 必要に応じて tax_rate = 0.08 等で計算するロジックに変更可能
    tax_val = 0 
    
    # 合計金額
    # order.total_amount を優先する（端数処理済みなどの可能性があるため）
    # もし order.total_amount と subtotal_val が大きく異なる場合は注意が必要だが、
    # ここでは order.total_amount を信頼しつつ、表示上の整合性を取る
    total_val = int(order.total_amount)
    
    # もし subtotal != total なら調整 (例: 送料など)
    # 今回は単純化のため、subtotalを表示し、totalを表示する。
    # 消費税欄が0だと不自然なら、(total - subtotal) を税とする手もあるが、
    # 既存ロジックに合わせておく。
    
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
    # 納品書の場合は振込先を表示しないなどの制御も可能だが、
    # HTMLテンプレート上は表示される構造になっている。
    # 空文字を渡せば非表示っぽくなるが、レイアウトが崩れる可能性がある。
    # 今回はそのまま表示するか、"-"にする。
    if title != "請求書":
        bank_info = {k: "" for k in bank_info}

    context = {
        "title": title, # "請求書" or "納品書" (HTML側で 請求書 と書かれていた部分を置換済み)
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
