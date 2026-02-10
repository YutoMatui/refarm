"""
Models module initialization.
Import all models to ensure they are registered with SQLAlchemy.
"""
from app.models.enums import (
    StockType,
    TaxRate,
    DeliveryTimeSlot,
    DeliverySlotType,
    OrderStatus,
    ProductCategory
)
from app.models.restaurant import Restaurant
from app.models.farmer import Farmer
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.consumer import Consumer
from app.models.consumer_order import ConsumerOrder, ConsumerOrderItem
from app.models.favorite import Favorite
from app.models.admin import Admin
from app.models.delivery_schedule import DeliverySchedule
from app.models.delivery_slot import DeliverySlot
from app.models.support_message import SupportMessage
from app.models.guest import GuestVisit, GuestInteraction
from app.models.analytics import FarmerFollow
from app.models.farmer_schedule import FarmerSchedule

__all__ = [
    # Enums
    "StockType",
    "TaxRate",
    "DeliveryTimeSlot",
    "DeliverySlotType",
    "OrderStatus",
    "ProductCategory",
    # Models
    "Restaurant",
    "Farmer",
    "Product",
    "Order",
    "OrderItem",
    "Consumer",
    "ConsumerOrder",
    "ConsumerOrderItem",
    "Favorite",
    "Admin",
    "DeliverySchedule",
    "DeliverySlot",
    "SupportMessage",
    "GuestVisit",
    "GuestInteraction",
    "FarmerFollow",
    "FarmerSchedule",
]
