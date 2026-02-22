"""
Refarm EOS - FastAPI Main Application
Production-grade ordering system for restaurants.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging
import subprocess
import os

from app.core.config import settings
from app.core.database import init_db

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Silence noisy debug logs
logging.getLogger("multipart").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)
logging.getLogger("cloudinary").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Run Alembic migrations automatically
    try:
        logger.info("Running database migrations...")
        # Using check=True to raise an exception if the command fails
        subprocess.run(
            ["alembic", "upgrade", "head"], 
            capture_output=True, 
            text=True, 
            check=True
        )
        logger.info("Database migrations completed successfully")
    except subprocess.CalledProcessError as e:
        logger.error("Database migration failed.")
        logger.error(f"Return code: {e.returncode}")
        logger.error(f"Stdout: {e.stdout}")
        logger.error(f"Stderr: {e.stderr}")
        # Re-raise the exception to stop the application startup
        raise e
    except Exception as e:
        logger.error(f"An unexpected error occurred during migration: {e}")
        raise e

    # Initialize database (optional, use Alembic for production)
    if settings.DEBUG:
        logger.warning("Debug mode: Checking tables")
        # await init_db()  # Skipped in favor of Alembic
    
    # Auto-seed data (Safe to run always as it checks for existence)
    try:
        from app.seed import seed_data
        logger.info("Running seed_data...")
        await seed_data()
    except Exception as e:
        logger.error(f"Auto-seeding failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="飲食店向け受発注システム - Production Grade API",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# CORS Middleware - Updated
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://refarm-nine.vercel.app",
    "https://app.refarmkobe.com",
    "https://refarm-production.up.railway.app",
]

# Merge with settings origins
for origin in settings.CORS_ORIGINS:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip Middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add X-Process-Time header to all responses."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    # CORS headers are added manually here because sometimes middleware fails on error
    origin = request.headers.get("origin")
    headers = {}
    if origin in allowed_origins or "*" in allowed_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        # Add headers needed for preflight requests
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        headers["Access-Control-Allow-Headers"] = request.headers.get("Access-Control-Request-Headers", "*")

    return JSONResponse(
        status_code=500,
        content={
            "message": "内部サーバーエラーが発生しました",
            "error": str(exc) if settings.DEBUG else "Internal Server Error",
        },
        headers=headers
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs" if settings.DEBUG else "Documentation disabled in production",
    }


# Import and include routers
from app.routers import (
    auth,
    restaurants,
    farmers,
    products,
    orders,
    favorites,
    upload,
    producer,
    settings as settings_router,
    logistics,
    admin_auth,
    admin_users,
    admin_delivery_slots as admin_delivery_slots_router,
    delivery_schedules,
    delivery_slot as delivery_slot_router,
    consumers as consumers_router,
    consumer_orders as consumer_orders_router,
    guest,
    admin_guest,
    support_messages,
    admin_consumers,
    admin_organizations,
    integrations_lp,
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(admin_auth.router, prefix="/api/admin/auth", tags=["Admin Authentication"])
app.include_router(admin_guest.router, prefix="/api/admin/guest", tags=["Admin Guest Management"])
app.include_router(admin_organizations.router, prefix="/api/admin", tags=["Admin Organization Management"])
app.include_router(admin_consumers.router, prefix="/api/admin", tags=["Admin Consumer Management"])
app.include_router(admin_users.router, prefix="/api/admin/users", tags=["Admin Users"])
app.include_router(admin_delivery_slots_router.router, prefix="/api/admin/delivery-slots", tags=["Admin Delivery Slots"])
app.include_router(delivery_schedules.router, prefix="/api/delivery-schedules", tags=["Delivery Schedules"])
app.include_router(delivery_slot_router.router, prefix="/api/delivery-slots", tags=["Delivery Slots"])
app.include_router(logistics.router, prefix="/api/logistics", tags=["Logistics"])
app.include_router(restaurants.router, prefix="/api/restaurants", tags=["Restaurants"])
app.include_router(farmers.router, prefix="/api/farmers", tags=["Farmers"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(producer.router, prefix="/api/producer", tags=["Producer"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(consumer_orders_router.router, prefix="/api/consumer-orders", tags=["Consumer Orders"])
app.include_router(consumers_router.router, prefix="/api/consumers", tags=["Consumers"])
app.include_router(favorites.router, prefix="/api/favorites", tags=["Favorites"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(support_messages.router, prefix="/api/support-messages", tags=["Support Messages"])
app.include_router(guest.router, prefix="/api") # guest router has /guest prefix already
app.include_router(integrations_lp.router, prefix="/api/integrations/lp", tags=["LP Integrations"])


# ----------------------------------------------------
# Manually resolve forward references in Pydantic models
# This is crucial for models with circular dependencies
# ----------------------------------------------------
from app.schemas.favorite import FavoriteWithProductResponse
from app.schemas.product import ProductResponse
from app.schemas.order import OrderResponse
from app.schemas.restaurant import RestaurantResponse
from app.schemas.consumer_order import ConsumerOrderResponse

logger.info("Resolving forward references in Pydantic schemas...")
FavoriteWithProductResponse.model_rebuild()
# ProductResponse doesn't have forward refs, but rebuilding is safe
ProductResponse.model_rebuild()
OrderResponse.model_rebuild()
RestaurantResponse.model_rebuild()
# ConsumerOrderResponse uses a local schema, but rebuilding for consistency
ConsumerOrderResponse.model_rebuild()
logger.info("Pydantic schemas rebuilt successfully.")
# ----------------------------------------------------


@app.get("/api/debug/seed", tags=["Debug"])
async def debug_seed_data():
    """
    Manually trigger data seeding.
    Useful if initial seeding failed or for testing.
    """
    try:
        from app.seed import seed_data
        await seed_data()
        return {"message": "Data seeding completed successfully"}
    except Exception as e:
        logger.error(f"Manual seeding failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"message": "Seeding failed", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
