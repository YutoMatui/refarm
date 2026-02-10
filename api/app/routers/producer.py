
@router.get("/dashboard/calendar-events")
async def get_producer_calendar_events(
    farmer_id: int = Query(None, description="生産者ID (省略可)"),
    month: str = Query(..., description="対象月 (YYYY-MM)"),
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    カレンダー表示用：注文がある日付のリストを取得
    """
    if farmer_id:
        stmt = select(Farmer).where(Farmer.id == farmer_id)
        result = await db.execute(stmt)
        farmer = result.scalar_one_or_none()
        if not farmer:
            raise HTTPException(status_code=404, detail="生産者が見つかりません")
        if farmer.line_user_id != line_user_id:
            raise HTTPException(status_code=403, detail="このデータへのアクセス権限がありません")
    else:
        farmer = await get_current_farmer(line_user_id, db)
        farmer_id = farmer.id

    try:
        target_month = datetime.strptime(month, "%Y-%m")
        # Start and end of month
        start_date = target_month.replace(day=1)
        _, last_day = calendar.monthrange(start_date.year, start_date.month)
        end_date = start_date.replace(day=last_day, hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    # Lightweight query: just get distinct delivery dates
    query = (
        select(func.date(Order.delivery_date).label("date"))
        .join(OrderItem.order)
        .join(OrderItem.product)
        .where(
            Product.farmer_id == farmer_id,
            Order.delivery_date >= start_date,
            Order.delivery_date <= end_date,
            Order.status != OrderStatus.CANCELLED
        )
        .group_by(func.date(Order.delivery_date))
    )
    
    result = await db.execute(query)
    dates = [row.date.strftime('%Y-%m-%d') for row in result.all()]
    
    return {"order_dates": dates}
