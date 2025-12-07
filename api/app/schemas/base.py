"""
Base Pydantic schemas with common fields.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TimestampSchema(BaseModel):
    """Base schema with timestamp fields."""
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class BaseSchema(BaseModel):
    """Base schema configuration."""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=False,
    )


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""
    skip: int = 0
    limit: int = 100
    
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "skip": 0,
                    "limit": 20
                }
            ]
        }
    )


class ResponseMessage(BaseModel):
    """Standard response message."""
    message: str
    success: bool = True
    
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "message": "操作が正常に完了しました",
                    "success": True
                }
            ]
        }
    )
