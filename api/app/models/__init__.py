"""
Models module initialization.
Import all models to ensure they are registered with SQLAlchemy.
"""
from app.models.enums import (
    StockType,
    TaxRate,
    DeliveryTimeSlot,
    OrderStatus,
    ProductCategory
)
from app.models.restaurant import Restaurant
from app.models.farmer import Farmer
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.favorite import Favorite
from app.models.admin import Admin

__all__ = [
    # Enums
    "StockType",
    "TaxRate",
    "DeliveryTimeSlot",
    "OrderStatus",
    "ProductCategory",
    # Models
    "Restaurant",
    "Farmer",
    "Product",
    "Order",
    "OrderItem",
    "Favorite",
    "Admin",
]
