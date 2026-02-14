from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class OrganizationBase(BaseModel):
    name: str = Field(..., title="組織名", description="組織・企業の名称")
    address: str = Field(..., title="住所", description="組織の住所")
    phone_number: str = Field(..., title="電話番号", description="組織の連絡先電話番号")

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None

class OrganizationResponse(OrganizationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OrganizationList(BaseModel):
    items: List[OrganizationResponse]
    total: int
