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
from app.schemas.consumer import (
    ConsumerAuthRequest,
    ConsumerRegisterRequest,
    ConsumerUpdateRequest,
    ConsumerResponse,
    ConsumerAuthResponse,
    ConsumerExistsResponse,
)
from app.schemas.delivery_slot import (
    DeliverySlotCreate,
    DeliverySlotUpdate,
    DeliverySlotResponse,
    DeliverySlotPublicResponse,
    DeliverySlotListResponse,
)
from app.schemas.consumer_order import (
    ConsumerOrderCreate,
    ConsumerOrderResponse,
    ConsumerOrderListResponse,
    ConsumerOrderItemResponse,
)

# Forward reference resolution for circular dependencies
FavoriteWithProductResponse.model_rebuild()

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
    # Consumer
    "ConsumerAuthRequest",
    "ConsumerRegisterRequest",
    "ConsumerUpdateRequest",
    "ConsumerResponse",
    "ConsumerAuthResponse",
    "ConsumerExistsResponse",
    # Delivery Slot
    "DeliverySlotCreate",
    "DeliverySlotUpdate",
    "DeliverySlotResponse",
    "DeliverySlotPublicResponse",
    "DeliverySlotListResponse",
    # Consumer Orders
    "ConsumerOrderCreate",
    "ConsumerOrderResponse",
    "ConsumerOrderListResponse",
    "ConsumerOrderItemResponse",
]
