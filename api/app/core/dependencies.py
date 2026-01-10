"""
FastAPI dependencies for authentication and authorization.
"""
from fastapi import Depends, HTTPException, status, Header
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_from_token
from app.models import Restaurant


async def get_line_user_id(
    authorization: Optional[str] = Header(None)
) -> str:
    """
    Extract and verify LINE User ID from Authorization header.
    
    Header format: "Bearer {id_token}"
    
    Returns:
        str: Verified LINE User ID
        
    Raises:
        HTTPException: If token is missing or invalid
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        scheme, id_token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token with LINE's server
    try:
        user_info = await get_current_user_from_token(id_token)
        return user_info["user_id"]
    except Exception as e:
        # Fallback for development/admin tokens if needed, but in prod we should be strict
        # Checking if it's an admin token handled elsewhere, but this dependency is for LINE users.
        # If the token is invalid for LINE, we throw 401.
        
        # Exception: Allow specific mock tokens in DEBUG mode
        from app.core.config import settings
        if settings.DEBUG and (id_token.startswith("mock-") or id_token == "Uk-id-token"):
             # Return a predictable ID for testing
             return "Uf84a1f7dfb47a12c704d6ac8b438f873" # Matches seed farmer/restaurant if needed, or specific mock ID
             
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_restaurant(
    line_user_id: str = Depends(get_line_user_id),
    db: AsyncSession = Depends(get_db)
) -> Restaurant:
    """
    Get current restaurant from verified LINE User ID.
    
    Args:
        line_user_id: Verified LINE User ID
        db: Database session
        
    Returns:
        Restaurant: Current restaurant object
        
    Raises:
        HTTPException: If restaurant not found
    """
    stmt = select(Restaurant).where(
        Restaurant.line_user_id == line_user_id,
        Restaurant.deleted_at.is_(None),
        Restaurant.is_active == 1
    )
    result = await db.execute(stmt)
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not registered. Please complete registration first."
        )
    
    return restaurant


# Optional: For development/testing without token
def get_mock_line_user_id() -> str:
    """Mock LINE User ID for development."""
    return "U1234567890abcdef"
