"""
Admin Access Logs Router
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.routers.admin_auth import get_current_admin
from app.models import AccessLog
from app.schemas import AccessLogListResponse

router = APIRouter()


@router.get("/access-logs", response_model=AccessLogListResponse)
async def list_access_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    actor_type: str | None = Query(None, description="restaurant / farmer"),
    actor_id: int | None = Query(None, description="actor id"),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(AccessLog)
    count_query = select(func.count(AccessLog.id))

    if actor_type:
        query = query.where(AccessLog.actor_type == actor_type)
        count_query = count_query.where(AccessLog.actor_type == actor_type)
    if actor_id:
        query = query.where(AccessLog.actor_id == actor_id)
        count_query = count_query.where(AccessLog.actor_id == actor_id)

    total = await db.scalar(count_query)

    query = query.order_by(desc(AccessLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return AccessLogListResponse(
        items=logs,
        total=total or 0,
        skip=skip,
        limit=limit,
    )
