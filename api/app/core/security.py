"""
Security utilities for LINE LIFF authentication.
ID Token verification to prevent user impersonation.
"""
import httpx
import logging
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)


async def verify_line_id_token(id_token: str) -> dict:
    """
    Verify LINE ID Token and extract user information.
    
    This prevents user impersonation by validating the token with LINE's server.
    
    Args:
        id_token: ID Token from LIFF SDK
        
    Returns:
        dict: Decoded token payload containing user_id, email, etc.
        
    Raises:
        HTTPException: If token is invalid or verification fails
    """
    try:
        # Step 1: Verify token with LINE's verification endpoint
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.line.me/oauth2/v2.1/verify",
                data={
                    "id_token": id_token,
                    "client_id": settings.LINE_CHANNEL_ID,
                }
            )
            
            if response.status_code != 200:
                logger.error(f"LINE token verification failed: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid LINE ID Token"
                )
            
            # Step 2: Decode token to get user information
            payload = response.json()
            
            # Validate required fields
            if "sub" not in payload:  # sub = LINE User ID
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            logger.info(f"LINE User authenticated: {payload.get('sub')}")
            
            return {
                "user_id": payload.get("sub"),  # LINE User ID
                "name": payload.get("name"),
                "picture": payload.get("picture"),
                "email": payload.get("email"),
            }
            
    except httpx.RequestError as e:
        logger.error(f"Network error during LINE token verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LINE authentication service unavailable"
        )
    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )


def verify_line_id_token_mock(id_token: str) -> dict:
    """
    Mock version for development/testing.
    In production, use verify_line_id_token() instead.
    """
    if not id_token or id_token == "invalid":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Default to Test User ID for development convenience
    # This ensures that if real verification fails in dev, we get a privileged user
    user_id = settings.LINE_TEST_USER_ID

    # Allow specifying ID in mock token for testing specific users
    if id_token.startswith("mock-U"):
        user_id = id_token[5:]

    # Mock user data for development
    return {
        "user_id": user_id,
        "name": "テストユーザー",
        "picture": None,
        "email": None,
    }


async def get_current_user_from_token(id_token: str) -> dict:
    """
    Main authentication function.
    Use this as a FastAPI dependency.
    
    Args:
        id_token: ID Token from Authorization header
        
    Returns:
        dict: User information from verified token
    """
    # Original logic (uncommented)
    if settings.DEBUG:
        # Development mode: use mock verification
        logger.warning("Using mock LINE token verification (DEBUG mode)")
        
        # If token is explicitly a mock token or very short (likely mock)
        if id_token == 'mock-id-token' or len(id_token) < 50:
             return verify_line_id_token_mock(id_token)

        try:
            return await verify_line_id_token(id_token)
        except Exception:
            logger.warning("Real token verification failed in DEBUG mode, falling back to mock")
            return verify_line_id_token_mock(id_token)
    else:
        # Production mode: verify with LINE's server
        return await verify_line_id_token(id_token)

from datetime import datetime, timedelta, timezone
import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash using direct bcrypt."""
    try:
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using direct bcrypt."""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
