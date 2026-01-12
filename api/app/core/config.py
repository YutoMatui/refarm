"""
Application configuration using Pydantic Settings.
"""
from typing import List, Union, Any
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "Refarm EOS"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173", 
        "http://localhost:3000",
        "https://refarm-po00du52z-refarm-ff84e7d8.vercel.app",
        "https://refarm-nine.vercel.app",
        "https://app.refarmkobe.com"
    ]
    
    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v: str) -> str:
        """Ensure DATABASE_URL starts with postgresql+asyncpg://"""
        if v and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v and v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Parse comma-separated CORS origins."""
        if isinstance(v, str) and not v.startswith("["):
            return [origin.strip() for origin in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(v)
    
    @validator("CORS_ORIGINS")
    def ensure_production_origin(cls, v: List[str]) -> List[str]:
        """Always include production domain in CORS origins."""
        prod_origin = "https://app.refarmkobe.com"
        if prod_origin not in v:
            v.append(prod_origin)
        return v
    
    # LINE LIFF
    LIFF_ID: str = "2008674356-P5YFllFd"
    FARMER_LIFF_ID: str = "2008689915-hECRflxu"
    RESTAURANT_LIFF_ID: str = "2008674356-P5YFllFd"
    LINE_CHANNEL_ID: str = ""
    LINE_CHANNEL_SECRET: str = ""

    # LINE Messaging API (Restaurant)
    LINE_RESTAURANT_CHANNEL_ID: str = "2008751355"
    LINE_RESTAURANT_CHANNEL_SECRET: str = "92d720cf8a7d037a58b4cf5bc5e25115"

    # LINE Messaging API (Producer)
    LINE_PRODUCER_CHANNEL_ID: str = "2008751402"
    LINE_PRODUCER_CHANNEL_SECRET: str = "5928cc0acec4d1e51b21b3d5e8f46cd9"

    # LINE Test User ID
    LINE_TEST_USER_ID: str = "Uf84a1f7dfb47a12c704d6ac8b438f873"
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    
    # Timezone
    TZ: str = "Asia/Tokyo"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
