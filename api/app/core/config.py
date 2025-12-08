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
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173", "http://localhost:3000"]
    
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
    
    # LINE LIFF
    LIFF_ID: str = ""
    LINE_CHANNEL_SECRET: str = ""
    
    # Timezone
    TZ: str = "Asia/Tokyo"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
