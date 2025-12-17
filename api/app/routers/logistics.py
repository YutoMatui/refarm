
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from datetime import date, datetime
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.models import Farmer, Restaurant, Order
from app.services.route_service import route_service

router = APIRouter()

@router.get("/routes/collection", summary="集荷ルート計算 (出発点 -> 農家 -> 大学)")
async def calculate_collection_route(
    start_address: str = Query(..., description="出発点の住所"),
    farmer_ids: Optional[List[int]] = Query(None, description="訪問する農家IDリスト (指定なければ全アクティブ農家)"),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Farmers
    query = select(Farmer).where(Farmer.is_active == 1)
    if farmer_ids:
        query = query.where(Farmer.id.in_(farmer_ids))
    
    result = await db.execute(query)
    farmers = result.scalars().all()
    
    if not farmers:
        raise HTTPException(status_code=404, detail="訪問対象の農家が見つかりません")
    
    # 2. Format for Service
    farmer_dicts = []
    for f in farmers:
        farmer_dicts.append({
            "id": f.id,
            "name": f.name,
            "address": f.address,
            "latitude": f.latitude,
            "longitude": f.longitude,
            "type": "farmer"
        })
        
    # 3. Calculate Route
    route_result = await route_service.calculate_farmer_route(start_address, farmer_dicts)
    
    if "error" in route_result:
        raise HTTPException(status_code=400, detail=route_result)
        
    return route_result


@router.get("/routes/delivery", summary="配送ルート計算 (大学 -> 飲食店)")
async def calculate_delivery_route(
    target_date: Optional[date] = Query(None, description="配送日 (YYYY-MM-DD). デフォルトは今日"),
    db: AsyncSession = Depends(get_db)
):
    if target_date is None:
        target_date = datetime.now().date()
        
    # 1. Find Restaurants with orders on this date
    # Join Order -> Restaurant
    query = select(Restaurant).join(Order).where(
        Order.delivery_date >= datetime.combine(target_date, datetime.min.time()),
        Order.delivery_date <= datetime.combine(target_date, datetime.max.time()),
        Restaurant.is_active == 1
    ).distinct()
    
    result = await db.execute(query)
    restaurants = result.scalars().all()
    
    if not restaurants:
        # Fallback: Just get all active restaurants if no orders found (for demo/testing purposes)
        # Or return empty with message. The prompt implies "schedule for that day".
        # Let's return 404 but with a helpful message, or maybe allow an override to show all.
        # For this implementation, let's fetch ALL active restaurants if no orders, 
        # so the user can see *something* in the UI even without orders.
        # BUT, strictly following requirements: "restaurants scheduled for delivery".
        # So correct behavior is 404 or empty list. 
        # However, to be helpful in a sandbox with empty DB, I'll return specific error.
        
        # Checking if there are ANY restaurants at all?
        check_query = select(Restaurant).limit(1)
        check_res = await db.execute(check_query)
        if not check_res.scalar_one_or_none():
             raise HTTPException(status_code=404, detail="飲食店が登録されていません")

        # Assuming user might want to see route even without orders for testing
        # I'll add a 'force_all' param in future, but for now, let's just return distinct error
        raise HTTPException(status_code=404, detail=f"{target_date} の配送予定がある飲食店が見つかりません")

    # 2. Format for Service
    restaurant_dicts = []
    for r in restaurants:
        restaurant_dicts.append({
            "id": r.id,
            "name": r.name,
            "address": r.address,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "delivery_window_start": r.delivery_window_start,
            "delivery_window_end": r.delivery_window_end,
            "type": "restaurant"
        })
        
    # 3. Calculate Route
    route_result = await route_service.calculate_restaurant_route(restaurant_dicts)
    
    if "error" in route_result:
        raise HTTPException(status_code=400, detail=route_result)
        
    return route_result
