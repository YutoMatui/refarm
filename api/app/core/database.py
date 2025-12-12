"""
Async Database connection and session management using SQLAlchemy 2.0.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Configure engine arguments based on database type
engine_args = {
    "echo": settings.DEBUG,
    "future": True,
    "pool_pre_ping": True,
}

# SQLite does not support pool_size/max_overflow with NullPool (default)
if "sqlite" not in settings.DATABASE_URL:
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_args
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session.
    Yields async session and ensures proper cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database - create all tables.
    Should only be used in development. Use Alembic for production.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
