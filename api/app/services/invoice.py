import io
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib import colors

# Font Configuration
FONT_PATH = "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
FONT_NAME = "JapaneseFont"

# Attempt to register font
try:
    if os.path.exists(FONT_PATH):
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))
    else:
        # Fallback to standard font (Japanese won't render correctly)
        print(f"Font not found at {FONT_PATH}, falling back to Helvetica")
        FONT_NAME = "Helvetica"
except Exception as e:
    print(f"Error registering font: {e}, falling back to Helvetica")
    FONT_NAME = "Helvetica"

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
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Constants
    MARGIN_X = 20 * mm
    MARGIN_Y = 20 * mm
    
    # --- Header ---
    c.setFont(FONT_NAME, 18)
    c.drawString(width/2 - 30*mm, height - MARGIN_Y, title)
    
    # --- Customer ---
    c.setFont(FONT_NAME, 12)
    c.drawString(MARGIN_X, height - 50*mm, f"{order.restaurant.name} 様")
    if title == "請求書":
         c.drawString(MARGIN_X + 60*mm, height - 50*mm, "御中")
    
    if title == "請求書":
        c.setFont(FONT_NAME, 10)
        c.drawString(MARGIN_X, height - 60*mm, "下記のとおり、御請求申し上げます。")
    
    # --- Subject & Payment Info ---
    c.setFont(FONT_NAME, 12)
    c.drawString(MARGIN_X, height - 75*mm, "件名")
    c.setFont(FONT_NAME, 14)
    c.drawString(MARGIN_X + 20*mm, height - 75*mm, "野菜代金")
    
    # Dates
    invoice_date = order.created_at or datetime.now()
    if order.confirmed_at:
        invoice_date = order.confirmed_at
    
    if title == "請求書":
        payment_deadline = invoice_date + relativedelta(months=1)
        payment_deadline = payment_deadline.replace(day=1) + relativedelta(months=1, days=-1) # End of next month
        
        c.setFont(FONT_NAME, 10)
        c.drawString(MARGIN_X, height - 85*mm, f"支払期限 {payment_deadline.strftime('%Y/%m/%d')}")
        c.drawString(MARGIN_X + 60*mm, height - 85*mm, "振込先 三井住友銀行 板宿支店 普通 4792089")
    
    # --- Total Amount ---
    c.setFont(FONT_NAME, 12)
    c.drawString(MARGIN_X, height - 100*mm, "合計")
    c.setFont(FONT_NAME, 16)
    # Format currency
    total_str = f"{int(order.total_amount):,} 円 (税込)"
    c.drawString(MARGIN_X + 20*mm, height - 100*mm, total_str)
    
    # --- Issuer Info (Right side) ---
    c.setFont(FONT_NAME, 10)
    info_x = width - MARGIN_X - 60*mm
    info_y = height - 50*mm
    line_height = 5*mm
    
    c.drawString(info_x, info_y, f"No. {1000 + order.id}") # Simple number logic
    c.drawString(info_x, info_y - line_height, f"発行日 {invoice_date.strftime('%Y/%m/%d')}")
    
    c.setFont(FONT_NAME, 12)
    c.drawString(info_x, info_y - line_height*3, "りふぁーむ")
    
    c.setFont(FONT_NAME, 9)
    c.drawString(info_x, info_y - line_height*4, "〒653-0845")
    c.drawString(info_x, info_y - line_height*5, "兵庫県神戸市長田区戸崎通 2-8-5")
    c.drawString(info_x, info_y - line_height*6, "メゾン戸崎通 101")
    c.drawString(info_x, info_y - line_height*7, "TEL：090-9614-4516")
    c.drawString(info_x, info_y - line_height*8, "担当：松井優人")
    
    # --- Table ---
    table_y = height - 120*mm
    table_x = MARGIN_X
    col_widths = [80*mm, 20*mm, 20*mm, 25*mm, 25*mm] # Name, Qty, Unit, UnitPrice, Amount
    headers = ["摘要", "数量", "単位", "単価", "金額"]
    
    # Draw Headers
    c.setFont(FONT_NAME, 10)
    current_x = table_x
    for i, header in enumerate(headers):
        c.drawString(current_x + 2*mm, table_y, header) # Align left + padding
        current_x += col_widths[i]
        
    # Draw Line under headers
    c.line(table_x, table_y - 2*mm, width - MARGIN_X, table_y - 2*mm)
    
    # Draw Items
    y = table_y - 8*mm
    c.setFont(FONT_NAME, 10)
    
    for item in order.order_items:
        current_x = table_x
        
        # Name
        c.drawString(current_x + 2*mm, y, item.product_name)
        current_x += col_widths[0]
        
        # Qty
        c.drawRightString(current_x + col_widths[1] - 5*mm, y, str(item.quantity))
        current_x += col_widths[1]
        
        # Unit
        c.drawString(current_x + 2*mm, y, item.product_unit)
        current_x += col_widths[2]
        
        # Unit Price
        c.drawRightString(current_x + col_widths[3] - 5*mm, y, f"{int(item.unit_price):,}")
        current_x += col_widths[3]
        
        # Amount
        c.drawRightString(current_x + col_widths[4] - 5*mm, y, f"{int(item.subtotal):,}")
        
        y -= 6*mm
        
        # New page if needed
        if y < MARGIN_Y:
            c.showPage()
            c.setFont(FONT_NAME, 10)
            y = height - MARGIN_Y
    
    # Finalize
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
