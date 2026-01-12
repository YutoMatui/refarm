from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from app.core.database import get_db
from app.models.analytics import FarmerFollow
from app.models.farmer import Farmer
from app.models.restaurant import Restaurant
from app.core.dependencies import get_current_user_id # Assuming auth dependency exists or using simpler one for now
from pydantic import BaseModel

router = APIRouter(
    prefix="/follows",
    tags=["Follows"],
)

class FollowResponse(BaseModel):
    is_following: bool
    count: int

@router.post("/farmers/{farmer_id}", response_model=FollowResponse)
async def toggle_farmer_follow(
    farmer_id: int,
    # restaurant_id: int = 1, # TODO: Get from Auth
    # For now, we assume this is called by a Restaurant user.
    # We need a way to identify the Restaurant.
    # If using existing Auth system:
    # restaurant = Depends(get_current_restaurant)
    # But for now I'll use a mock restaurant_id or try to find one.
    db: AsyncSession = Depends(get_db)
):
    # Mocking restaurant_id = 1 for demo purposes if no auth
    # ideally: current_user = Depends(get_current_user) -> restaurant_id
    restaurant_id = 1 
    
    # Check if exists
    stmt = select(FarmerFollow).where(
        FarmerFollow.restaurant_id == restaurant_id,
        FarmerFollow.farmer_id == farmer_id
    )
    result = await db.execute(stmt)
    follow = result.scalar_one_or_none()
    
    if follow:
        # Unfollow
        await db.delete(follow)
        is_following = False
    else:
        # Follow
        new_follow = FarmerFollow(restaurant_id=restaurant_id, farmer_id=farmer_id)
        db.add(new_follow)
        is_following = True
    
    await db.commit()
    
    # Get count
    count_stmt = select(func.count(FarmerFollow.id)).where(FarmerFollow.farmer_id == farmer_id)
    count = (await db.execute(count_stmt)).scalar() or 0
    
    return FollowResponse(is_following=is_following, count=count)

@router.get("/farmers/{farmer_id}", response_model=FollowResponse)
async def get_farmer_follow_status(
    farmer_id: int,
    db: AsyncSession = Depends(get_db)
):
    restaurant_id = 1 # Mock
    
    stmt = select(FarmerFollow).where(
        FarmerFollow.restaurant_id == restaurant_id,
        FarmerFollow.farmer_id == farmer_id
    )
    result = await db.execute(stmt)
    follow = result.scalar_one_or_none()
    
    count_stmt = select(func.count(FarmerFollow.id)).where(FarmerFollow.farmer_id == farmer_id)
    count = (await db.execute(count_stmt)).scalar() or 0
    
    return FollowResponse(is_following=bool(follow), count=count)
