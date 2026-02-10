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
