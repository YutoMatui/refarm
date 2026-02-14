from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import Organization
from app.schemas import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationList
)
# from app.routers.admin_auth import get_current_admin # TODO: Add Auth check if needed

router = APIRouter(
    prefix="/admin/organizations",
    tags=["admin-organizations"]
)

@router.get("/", response_model=OrganizationList)
async def get_organizations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """組織一覧を取得"""
    query = select(Organization).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    # Total count
    count_query = select(func.count()).select_from(Organization)
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()
    
    return {"items": items, "total": total}

@router.post("/", response_model=OrganizationResponse)
async def create_organization(
    org_in: OrganizationCreate,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """組織を作成"""
    org = Organization(**org_in.model_dump())
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org

@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """組織詳細を取得"""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: int,
    org_in: OrganizationUpdate,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """組織を更新"""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update_data = org_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)
        
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org

@router.delete("/{org_id}")
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """組織を削除"""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    await db.delete(org)
    await db.commit()
    return {"ok": True}
