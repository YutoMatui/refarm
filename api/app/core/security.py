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
    Tries validation against multiple channel IDs (Restaurant & Producer) since
    tokens might come from different LIFF apps.
    
    Args:
        id_token: ID Token from LIFF SDK
        
    Returns:
        dict: Decoded token payload containing user_id, email, etc.
        
    Raises:
        HTTPException: If token is invalid or verification fails
    """
    # List of Channel IDs to verify against
    channel_ids = []
    if settings.LINE_CHANNEL_ID:
        channel_ids.append(settings.LINE_CHANNEL_ID)
    
    # Add Restaurant Channel ID (Messaging API channel often same as Login channel in unified provider, but LIFF might use Login Channel)
    # Note: LIFF ID is different from Channel ID. The token aud matches the Login Channel ID.
    # We should assume settings.LINE_RESTAURANT_CHANNEL_ID and PRODUCER might be the Login Channel IDs too
    # or separate settings should exist.
    # For now, let's try available IDs.
    if settings.LINE_RESTAURANT_CHANNEL_ID and settings.LINE_RESTAURANT_CHANNEL_ID not in channel_ids:
        channel_ids.append(settings.LINE_RESTAURANT_CHANNEL_ID)
    if settings.LINE_PRODUCER_CHANNEL_ID and settings.LINE_PRODUCER_CHANNEL_ID not in channel_ids:
        channel_ids.append(settings.LINE_PRODUCER_CHANNEL_ID)
        
    # If no channel IDs configured, we can't verify (unless we skip client_id check, but verify endpoint requires it)
    if not channel_ids:
        logger.error("No LINE Channel IDs configured for verification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error"
        )

    last_error = None
    
    async with httpx.AsyncClient() as client:
        for channel_id in channel_ids:
            try:
                response = await client.post(
                    "https://api.line.me/oauth2/v2.1/verify",
                    data={
                        "id_token": id_token,
                        "client_id": channel_id,
                    }
                )
                
                if response.status_code == 200:
                    # Success!
                    payload = response.json()
                    
                    # Validate required fields
                    if "sub" not in payload:
                        continue
                    
                    logger.info(f"LINE User authenticated: {payload.get('sub')} (Channel: {channel_id})")
                    
                    return {
                        "user_id": payload.get("sub"),
                        "name": payload.get("name"),
                        "picture": payload.get("picture"),
                        "email": payload.get("email"),
                    }
                else:
                    # Capture error but continue to next channel ID
                    error_detail = response.text
                    # Only log if it's the last attempt or specific errors?
                    # logger.debug(f"Verification failed for channel {channel_id}: {error_detail}")
                    pass
                    
            except httpx.RequestError as e:
                logger.error(f"Network error during LINE token verification: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="LINE authentication service unavailable"
                )
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                last_error = e

    # If we get here, all verifications failed
    logger.error("All LINE token verification attempts failed.")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid LINE ID Token"
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
    
    # Try to extract real ID from token (unverified) to avoid ID mismatch in frontend
    # This is useful when DEBUG=True but we are using real tokens (e.g. on device)
    # and real verification fails (e.g. due to network/config).
    try:
        claims = jwt.get_unverified_claims(id_token)
        if "sub" in claims:
             return {
                "user_id": claims["sub"],
                "name": claims.get("name", "Test User"),
                "picture": claims.get("picture"),
                "email": claims.get("email"),
            }
    except Exception:
        pass
    
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
