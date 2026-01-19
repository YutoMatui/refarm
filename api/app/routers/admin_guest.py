
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import csv
import io

from app.core.database import get_db
from app.models.restaurant import Restaurant
from app.models.guest import GuestVisit, GuestInteraction
from app.models.farmer import Farmer
from pydantic import BaseModel

router = APIRouter()

# --- Schemas ---

class AdminStoreResponse(BaseModel):
    id: int
    name: str
    message: Optional[str] = None
    line_user_id: Optional[str] = None

class StoreMessageUpdate(BaseModel):
    message: str

class InteractionLog(BaseModel):
    id: int
    created_at: datetime
    interaction_type: str
    stamp_type: Optional[str] = None
    comment: Optional[str] = None
    nickname: Optional[str] = None
    user_image_url: Optional[str] = None
    farmer_name: Optional[str] = None
    restaurant_name: Optional[str] = None

class AnalysisSummary(BaseModel):
    total_pv: int
    avg_stay_time: float
    total_comments: int
    total_stamps: int
    total_interests: int

class StampAggregation(BaseModel):
    farmer_id: int
    farmer_name: str
    count: int

class InterestAggregation(BaseModel):
    farmer_id: int
    farmer_name: str
    count: int

class RestaurantStatsResponse(BaseModel):
    restaurant_id: int
    restaurant_name: str
    message: Optional[str] = None
    visit_count: int
    interaction_count: int
    last_visit: Optional[datetime] = None

# --- Internal helpers ---

async def _update_store_message_internal(
    store_id: int,
    data: StoreMessageUpdate,
    db: AsyncSession,
) -> dict:
    store = await db.get(Restaurant, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    store.kodawari = data.message
    await db.commit()
    await db.refresh(store)
    return {"status": "ok", "message": store.kodawari}

async def _fetch_restaurant_stats(db: AsyncSession) -> List[RestaurantStatsResponse]:
    query = (
        select(
            Restaurant.id.label("restaurant_id"),
            Restaurant.name.label("restaurant_name"),
            Restaurant.kodawari.label("message"),
            func.count(func.distinct(GuestVisit.id)).label("visit_count"),
            func.count(GuestInteraction.id).label("interaction_count"),
            func.max(GuestVisit.created_at).label("last_visit"),
        )
        .outerjoin(GuestVisit, GuestVisit.restaurant_id == Restaurant.id)
        .outerjoin(GuestInteraction, GuestInteraction.visit_id == GuestVisit.id)
        .group_by(Restaurant.id, Restaurant.name, Restaurant.kodawari)
        .order_by(Restaurant.name)
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        RestaurantStatsResponse(
            restaurant_id=row.restaurant_id,
            restaurant_name=row.restaurant_name,
            message=row.message,
            visit_count=row.visit_count or 0,
            interaction_count=row.interaction_count or 0,
            last_visit=row.last_visit,
        )
        for row in rows
    ]

async def _fetch_comment_logs(limit: int, db: AsyncSession) -> List[InteractionLog]:
    query = (
        select(
            GuestInteraction,
            Farmer.name.label("farmer_name"),
            Restaurant.name.label("restaurant_name"),
        )
        .outerjoin(Farmer, GuestInteraction.farmer_id == Farmer.id)
        .join(GuestVisit, GuestInteraction.visit_id == GuestVisit.id)
        .join(Restaurant, GuestVisit.restaurant_id == Restaurant.id)
        .where(GuestInteraction.interaction_type == "MESSAGE")
        .order_by(desc(GuestInteraction.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    logs: List[InteractionLog] = []
    for interaction, f_name, r_name in rows:
        logs.append(
            InteractionLog(
                id=interaction.id,
                created_at=interaction.created_at,
                interaction_type=interaction.interaction_type,
                stamp_type=interaction.stamp_type,
                comment=interaction.comment,
                nickname=interaction.nickname,
                user_image_url=interaction.user_image_url,
                farmer_name=f_name,
                restaurant_name=r_name,
            )
        )
    return logs

async def _aggregate_stamp_data(db: AsyncSession) -> List[StampAggregation]:
    query = (
        select(
            Farmer.id,
            Farmer.name,
            func.count(GuestInteraction.id).label("count"),
        )
        .join(GuestInteraction, Farmer.id == GuestInteraction.farmer_id)
        .where(GuestInteraction.interaction_type == "STAMP")
        .group_by(Farmer.id, Farmer.name)
        .order_by(desc("count"))
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        StampAggregation(
            farmer_id=row.id,
            farmer_name=row.name,
            count=row.count,
        )
        for row in rows
    ]

# --- Endpoints ---

@router.get("/stores", response_model=List[AdminStoreResponse])
async def list_guest_stores(db: AsyncSession = Depends(get_db)):
    """
    ゲスト機能を利用する店舗一覧
    """
    result = await db.execute(select(Restaurant))
    stores = result.scalars().all()
    return [
        AdminStoreResponse(
            id=s.id,
            name=s.name,
            message=s.kodawari,
            line_user_id=s.line_user_id
        ) for s in stores
    ]

@router.put("/stores/{store_id}/message")
async def update_store_message(store_id: int, data: StoreMessageUpdate, db: AsyncSession = Depends(get_db)):
    return await _update_store_message_internal(store_id, data, db)

@router.put("/restaurants/{restaurant_id}/message")
async def update_restaurant_message(
    restaurant_id: int,
    data: StoreMessageUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await _update_store_message_internal(restaurant_id, data, db)

@router.get("/stats", response_model=List[RestaurantStatsResponse])
async def get_restaurant_stats(db: AsyncSession = Depends(get_db)):
    return await _fetch_restaurant_stats(db)

@router.get("/analysis/summary", response_model=AnalysisSummary)
async def get_analysis_summary(db: AsyncSession = Depends(get_db)):
    """
    全体のアクセス解析サマリ
    """
    # Total PV
    pv_query = select(func.count(GuestVisit.id))
    total_pv = (await db.execute(pv_query)).scalar() or 0

    # Avg Stay Time
    stay_query = select(func.avg(GuestVisit.stay_time_seconds)).where(GuestVisit.stay_time_seconds > 0)
    avg_stay = (await db.execute(stay_query)).scalar() or 0.0

    # Comments
    comment_query = select(func.count(GuestInteraction.id)).where(GuestInteraction.interaction_type == 'MESSAGE')
    total_comments = (await db.execute(comment_query)).scalar() or 0

    # Stamps
    stamp_query = select(func.count(GuestInteraction.id)).where(GuestInteraction.interaction_type == 'STAMP')
    total_stamps = (await db.execute(stamp_query)).scalar() or 0

    # Interests
    interest_query = select(func.count(GuestInteraction.id)).where(GuestInteraction.interaction_type == 'INTEREST')
    total_interests = (await db.execute(interest_query)).scalar() or 0

    return AnalysisSummary(
        total_pv=total_pv,
        avg_stay_time=round(avg_stay, 1),
        total_comments=total_comments,
        total_stamps=total_stamps,
        total_interests=total_interests
    )

@router.get("/analysis/comments", response_model=List[InteractionLog])
async def list_comments(limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await _fetch_comment_logs(limit, db)

@router.get("/comments", response_model=List[InteractionLog])
async def list_comments_admin(limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await _fetch_comment_logs(limit, db)

@router.get("/analysis/stamps", response_model=List[StampAggregation])
async def aggregate_stamps(db: AsyncSession = Depends(get_db)):
    return await _aggregate_stamp_data(db)

@router.get("/stamps", response_model=List[StampAggregation])
async def aggregate_stamps_admin(db: AsyncSession = Depends(get_db)):
    return await _aggregate_stamp_data(db)

@router.get("/analysis/interests", response_model=List[InterestAggregation])
async def aggregate_interests(db: AsyncSession = Depends(get_db)):
    """
    農家ごとの興味あり（クリック）数ランキング
    """
    query = (
        select(
            Farmer.id,
            Farmer.name,
            func.count(GuestInteraction.id).label("count"),
        )
        .join(GuestInteraction, Farmer.id == GuestInteraction.farmer_id)
        .where(GuestInteraction.interaction_type == "INTEREST")
        .group_by(Farmer.id, Farmer.name)
        .order_by(desc("count"))
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        InterestAggregation(
            farmer_id=row.id,
            farmer_name=row.name,
            count=row.count
        )
        for row in rows
    ]

@router.get("/analysis/csv")
async def export_guest_data_csv(db: AsyncSession = Depends(get_db)):
    """
    ゲスト利用データをCSVでエクスポート (アクセス解析用)
    """
    # Query visits
    query = (
        select(
            GuestVisit,
            Restaurant.name.label("restaurant_name")
        )
        .join(Restaurant, GuestVisit.restaurant_id == Restaurant.id)
        .order_by(desc(GuestVisit.created_at))
    )
    result = await db.execute(query)
    rows = result.all()
    
    # In-memory CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Visit ID", "Restaurant", "Visitor ID", "Date", "Stay Time (sec)", 
        "Scroll Depth (%)", "Nth Visit"
    ])
    
    # Calculate Nth visit in Python for now (simple counter)
    visitor_counts = {}
    
    # Since we ordered by DESC date, if we want Nth visit, we should process ASC or handle reverse.
    # Actually, simpler to just query all and sort by ASC created_at to count.
    # But rows are DESC.
    # Let's re-query ASC for counting, or just do it smart.
    
    # Re-querying in correct order for accurate Nth calculation
    query_asc = (
        select(
            GuestVisit,
            Restaurant.name.label("restaurant_name")
        )
        .join(Restaurant, GuestVisit.restaurant_id == Restaurant.id)
        .order_by(GuestVisit.created_at)
    )
    result_asc = await db.execute(query_asc)
    rows_asc = result_asc.all()
    
    csv_rows = []
    
    for visit, r_name in rows_asc:
        v_id = visit.visitor_id or "Anonymous"
        if v_id not in visitor_counts:
            visitor_counts[v_id] = 0
        visitor_counts[v_id] += 1
        
        csv_rows.append([
            visit.id,
            r_name,
            v_id,
            visit.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            visit.stay_time_seconds or 0,
            visit.scroll_depth or 0,
            visitor_counts[v_id]
        ])
    
    # Reverse back to DESC for export
    csv_rows.reverse()
    
    for row in csv_rows:
        writer.writerow(row)
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=guest_analytics.csv"}
    )


@router.delete("/visits/{visit_id}")
async def delete_guest_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """
    ゲスト訪問ログを削除（テストデータの削除用）
    関連するインタラクションも自動的に削除される（cascade設定済み）
    """
    visit = await db.get(GuestVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    await db.delete(visit)
    await db.commit()
    return {"status": "ok", "message": f"Visit {visit_id} deleted"}


@router.delete("/interactions/{interaction_id}")
async def delete_guest_interaction(interaction_id: int, db: AsyncSession = Depends(get_db)):
    """
    ゲストインタラクション（コメント・スタンプ等）を削除
    """
    interaction = await db.get(GuestInteraction, interaction_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    
    await db.delete(interaction)
    await db.commit()
    return {"status": "ok", "message": f"Interaction {interaction_id} deleted"}


@router.post("/visits/bulk-delete")
async def bulk_delete_visits(
    visitor_ids: List[str] = None,
    before_date: datetime = None,
    db: AsyncSession = Depends(get_db)
):
    """
    複数のゲスト訪問ログを一括削除
    - visitor_ids: 特定の訪問者IDのログを削除
    - before_date: 指定日時より前のログを削除
    """
    from sqlalchemy import and_
    
    conditions = []
    if visitor_ids:
        conditions.append(GuestVisit.visitor_id.in_(visitor_ids))
    if before_date:
        conditions.append(GuestVisit.created_at < before_date)
    
    if not conditions:
        raise HTTPException(status_code=400, detail="No deletion criteria specified")
    
    query = select(GuestVisit).where(and_(*conditions))
    result = await db.execute(query)
    visits_to_delete = result.scalars().all()
    
    count = len(visits_to_delete)
    for visit in visits_to_delete:
        await db.delete(visit)
    
    await db.commit()
    return {"status": "ok", "deleted_count": count}
