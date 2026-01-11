from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.core.database import get_db
from app.models.restaurant import Restaurant
from app.models.farmer import Farmer
from app.models.guest import GuestVisit, GuestInteraction
from pydantic import BaseModel

router = APIRouter(
    prefix="/guest",
    tags=["guest"],
)

# --- Schemas ---
class GuestRestaurantResponse(BaseModel):
    id: int
    name: str
    message: Optional[str] = None

class GuestFarmerResponse(BaseModel):
    id: int
    name: str
    main_crop: Optional[str] = None
    image: Optional[str] = None
    bio: Optional[str] = None
    scenes: List[str] = [] # Assuming we might fetch this from another table or JSON field

class VisitCreate(BaseModel):
    restaurant_id: int

class VisitResponse(BaseModel):
    visit_id: int

class InteractionCreate(BaseModel):
    visit_id: int
    farmer_id: int
    interaction_type: str # STAMP, MESSAGE, INTEREST
    stamp_type: Optional[str] = None
    comment: Optional[str] = None
    nickname: Optional[str] = None

class LogCreate(BaseModel):
    visit_id: int
    stay_time: int
    scroll_depth: Optional[int] = None

# --- Routes ---

@router.get("/restaurant/{restaurant_id}", response_model=GuestRestaurantResponse)
async def get_guest_restaurant(restaurant_id: int, db: AsyncSession = Depends(get_db)):
    """
    店舗情報とこだわりメッセージを取得
    """
    restaurant = await db.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Use kodawari as the message for now
    return GuestRestaurantResponse(
        id=restaurant.id, 
        name=restaurant.name, 
        message=restaurant.kodawari
    )

@router.get("/farmers", response_model=List[GuestFarmerResponse])
async def get_guest_farmers(db: AsyncSession = Depends(get_db)):
    """
    全ての生産者情報を取得 (カルーセル用)
    """
    # Fetch all active farmers
    result = await db.execute(select(Farmer).where(Farmer.is_active == 1))
    farmers = result.scalars().all()
    
    response = []
    for f in farmers:
        # scenes logic: simplistic extraction from 'article_url' or similar if needed.
        # For now, just return empty list or parsed JSON if available.
        # Assuming f.profile_photo_url is the main image.
        
        response.append(GuestFarmerResponse(
            id=f.id, 
            name=f.name, 
            main_crop=f.main_crop,
            image=f.profile_photo_url, 
            bio=f.kodawari or f.bio,
            scenes=[] # Populate this if we have a way to store multiple images (e.g. from JSON fields)
        ))
    return response

@router.post("/visit", response_model=VisitResponse)
async def create_visit(visit: VisitCreate, db: AsyncSession = Depends(get_db)):
    """
    訪問セッションの開始（ログ記録）
    """
    new_visit = GuestVisit(restaurant_id=visit.restaurant_id)
    db.add(new_visit)
    await db.commit()
    await db.refresh(new_visit)
    return VisitResponse(visit_id=new_visit.id)

@router.post("/interaction")
async def create_interaction(interaction: InteractionCreate, db: AsyncSession = Depends(get_db)):
    """
    スタンプ、メッセージ、興味ありログの記録
    """
    try:
        new_interaction = GuestInteraction(
            visit_id=interaction.visit_id,
            farmer_id=interaction.farmer_id,
            interaction_type=interaction.interaction_type,
            stamp_type=interaction.stamp_type,
            comment=interaction.comment,
            nickname=interaction.nickname
        )
        db.add(new_interaction)
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        import traceback
        print(f"Error in create_interaction: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post("/log")
async def log_visit_metrics(log: LogCreate, db: AsyncSession = Depends(get_db)):
    """
    滞在時間、スクロール率の更新
    """
    visit = await db.get(GuestVisit, log.visit_id)
    if visit:
        visit.stay_time_seconds = log.stay_time
        visit.scroll_depth = log.scroll_depth
        await db.commit()
    return {"status": "ok"}
