from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import HarvestStatus, FarmingMethod

class ProducerProductCreate(BaseModel):
    """Schema for creating a product by a producer."""
    name: str = Field(..., min_length=1, max_length=200, description="野菜の名前")
    variety: Optional[str] = Field(None, max_length=200, description="品種")
    farming_method: Optional[FarmingMethod] = Field(None, description="栽培方法")
    weight: Optional[int] = Field(None, description="重量(g)")
    unit: str = Field(..., max_length=20, description="単位")
    cost_price: int = Field(..., gt=0, description="仕入れ値")
    harvest_status: HarvestStatus = Field(..., description="収穫状況")
    image_url: Optional[str] = Field(None, description="商品画像URL")
    description: Optional[str] = Field(None, description="こだわりポイント・説明")
    is_wakeari: int = Field(default=0, description="訳ありフラグ")
    farmer_id: int = Field(..., description="生産者ID")

class ProducerProductUpdate(BaseModel):
    """Schema for updating a product by a producer."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    variety: Optional[str] = None
    farming_method: Optional[FarmingMethod] = None
    weight: Optional[int] = None
    unit: Optional[str] = Field(None, max_length=20)
    cost_price: Optional[int] = Field(None, gt=0)
    harvest_status: Optional[HarvestStatus] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    is_wakeari: Optional[int] = None

class ProducerProfileUpdate(BaseModel):
    """Schema for updating producer profile."""
    name: Optional[str] = Field(None, description="農園名")
    bio: Optional[str] = Field(None, description="紹介文")
    profile_photo_url: Optional[str] = Field(None, description="プロフィール画像")
    cover_photo_url: Optional[str] = Field(None, description="背景（カバー）画像")
    address: Optional[str] = Field(None, description="所在地")
    commitments: Optional[list] = Field(None, description="こだわり情報")
    achievements: Optional[list] = Field(None, description="実績リスト")
    chef_comments: Optional[list] = Field(None, description="シェフからのコメント")
