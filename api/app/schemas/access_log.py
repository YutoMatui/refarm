"""
Access log schemas.
"""
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.base import BaseSchema, TimestampSchema


class AccessLogResponse(BaseSchema, TimestampSchema):
    id: int
    actor_type: str
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    line_user_id: Optional[str] = None
    action: Optional[str] = None
    path: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AccessLogListResponse(BaseModel):
    items: List[AccessLogResponse]
    total: int
    skip: int
    limit: int
