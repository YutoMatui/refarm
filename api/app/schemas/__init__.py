"""
Schemas module initialization.
"""
from app.schemas.base import (
    BaseSchema,
    TimestampSchema,
    PaginationParams,
    ResponseMessage,
)
from app.schemas.restaurant import (
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantResponse,
    RestaurantListResponse,
)
from app.schemas.farmer import (
    FarmerCreate,
    FarmerUpdate,
    FarmerResponse,
    FarmerListResponse,
)
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductFilterParams,
)
from app.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderListResponse,
    OrderFilterParams,
    OrderStatusUpdate,
    OrderItemResponse,
)
from app.schemas.favorite import (
    FavoriteCreate,
    FavoriteUpdate,
    FavoriteResponse,
    FavoriteWithProductResponse,
    FavoriteListResponse,
    FavoriteToggleRequest,
    FavoriteToggleResponse,
)

__all__ = [
    # Base
    "BaseSchema",
    "TimestampSchema",
    "PaginationParams",
    "ResponseMessage",
    # Restaurant
    "RestaurantCreate",
    "RestaurantUpdate",
    "RestaurantResponse",
    "RestaurantListResponse",
    # Farmer
    "FarmerCreate",
    "FarmerUpdate",
    "FarmerResponse",
    "FarmerListResponse",
    # Product
    "ProductCreate",
    "ProductUpdate",
    "ProductResponse",
    "ProductListResponse",
    "ProductFilterParams",
    # Order
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "OrderListResponse",
    "OrderFilterParams",
    "OrderStatusUpdate",
    "OrderItemResponse",
    # Favorite
    "FavoriteCreate",
    "FavoriteUpdate",
    "FavoriteResponse",
    "FavoriteWithProductResponse",
    "FavoriteListResponse",
    "FavoriteToggleRequest",
    "FavoriteToggleResponse",
]
