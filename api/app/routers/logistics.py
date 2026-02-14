from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, func
from datetime import date, datetime, time as datetime_time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.models import Farmer, Restaurant, Order, OrderItem, Product
from app.services.route_service import route_service

logger = logging.getLogger(__name__)

router = APIRouter()

class RouteRequest(BaseModel):
    target_date: date
    start_address: str

@router.get("/routes/collection", summary="集荷ルート計算 (出発点 -> 農家 -> 大学)")
async def calculate_collection_route(
    start_address: str = Query(..., description="出発点の住所"),
    farmer_ids: Optional[List[int]] = Query(None, description="訪問する農家IDリスト (指定なければ全アクティブ農家)"),
    db: AsyncSession = Depends(get_db)
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating collection route: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ルート計算中にエラーが発生しました: {str(e)}")


@router.get("/routes/delivery", summary="配送ルート計算 (大学 -> 飲食店)")
async def calculate_delivery_route(
    target_date: Optional[date] = Query(None, description="配送日 (YYYY-MM-DD). デフォルトは今日"),
    db: AsyncSession = Depends(get_db)
):
    try:
        if target_date is None:
            target_date = datetime.now().date()
            
        # 1. Find Restaurants with orders on this date
        # Join Order -> Restaurant
        query = select(Restaurant).join(Order).where(
            func.date(Order.delivery_date) == target_date,
            Restaurant.is_active == 1
        ).distinct()
        
        result = await db.execute(query)
        restaurants = result.scalars().all()
        
        if not restaurants:
            check_query = select(Restaurant).limit(1)
            check_res = await db.execute(check_query)
            if not check_res.scalar_one_or_none():
                 raise HTTPException(status_code=404, detail="飲食店が登録されていません")

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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating delivery route: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ルート計算中にエラーが発生しました: {str(e)}")


@router.post("/route/delivery", summary="配送ルート一括計算 (出発点 -> 農家 -> 大学 -> 飲食店)")
async def calculate_full_delivery_route(
    request: RouteRequest = Body(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_date = request.target_date
        start_address = request.start_address
        
        # 1. Determine target Orders for the date
        stmt = select(Order).where(
            func.date(Order.delivery_date) == target_date,
            Order.status != "cancelled"
        )
        result = await db.execute(stmt)
        orders = result.scalars().all()
        
        if not orders:
            raise HTTPException(status_code=404, detail=f"{target_date} の注文が見つかりません")
            
        order_ids = [o.id for o in orders]
        restaurant_ids = list(set([o.restaurant_id for o in orders]))
        
        # 2. Get Restaurants
        if not restaurant_ids:
             raise HTTPException(status_code=404, detail="配送先の飲食店が見つかりません")
             
        res_stmt = select(Restaurant).where(Restaurant.id.in_(restaurant_ids))
        res_result = await db.execute(res_stmt)
        restaurants = res_result.scalars().all()
        
        restaurant_dicts = []
        for r in restaurants:
            restaurant_dicts.append({
                "id": r.id,
                "name": r.name,
                "address": r.address,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "type": "restaurant"
            })

        # 3. Get Farmers
        # Use distinct() method on the query instead of distinct(Column) inside select
        # This is safer across SQLAlchemy versions and DB backends
        farmer_id_stmt = select(Farmer.id).join(Product, Product.farmer_id == Farmer.id)\
            .join(OrderItem, OrderItem.product_id == Product.id)\
            .join(Order, OrderItem.order_id == Order.id)\
            .where(
                Order.id.in_(order_ids)
            ).distinct()
            
        farmer_id_result = await db.execute(farmer_id_stmt)
        farmer_ids = farmer_id_result.scalars().all()

        if not farmer_ids:
            # No farmers to visit (only market products?), but route calculation might still proceed for restaurants
            farmers = []
        else:
            farmers_stmt = select(Farmer).where(Farmer.id.in_(farmer_ids))
            farmers_result = await db.execute(farmers_stmt)
            farmers = farmers_result.scalars().all()
        
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

        # 4. Calculate Full Route
        route_result = await route_service.calculate_full_route(start_address, farmer_dicts, restaurant_dicts)
        
        if "error" in route_result:
            # If detail says "No farmers provided", we can still return partial result (handled in service but double check)
            # But if calculate_full_route returns an error object, it failed.
            # However, route_service.calculate_full_route returns a composite object if successful even partially.
            # Check if the result is actually an error dict
            if "summary" not in route_result:
                 raise HTTPException(status_code=400, detail=route_result)
        
        return route_result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating full route: {e}", exc_info=True)
        # Return 500 but with detail so frontend can show something
        raise HTTPException(status_code=500, detail=f"ルート計算処理エラー: {str(e)}")
