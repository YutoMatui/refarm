"""
Enum definitions for database models.
"""
import enum


class StockType(str, enum.Enum):
    """野菜の種類 (Stock Type)."""
    KOBE = "KOBE"  # 神戸野菜 (Kobe Veggie)
    OTHER = "OTHER"  # その他の野菜 (Other Veggie)


class TaxRate(int, enum.Enum):
    """消費税率 (Tax Rate)."""
    STANDARD = 10  # 標準税率 10%
    REDUCED = 8    # 軽減税率 8% (食品)


class DeliveryTimeSlot(str, enum.Enum):
    """配送時間枠 (Delivery Time Slot)."""
    SLOT_12_14 = "12-14"  # 12:00-14:00
    SLOT_14_16 = "14-16"  # 14:00-16:00
    SLOT_16_18 = "16-18"  # 16:00-18:00


class OrderStatus(str, enum.Enum):
    """注文ステータス (Order Status)."""
    PENDING = "pending"        # 受注待ち
    CONFIRMED = "confirmed"    # 受注確定
    PREPARING = "preparing"    # 準備中
    SHIPPED = "shipped"        # 配送中
    DELIVERED = "delivered"    # 配達完了
    CANCELLED = "cancelled"    # キャンセル


class ProductCategory(str, enum.Enum):
    """商品カテゴリ (Product Category)."""
    LEAFY = "leafy"           # 葉物野菜
    ROOT = "root"             # 根菜
    FRUIT_VEG = "fruit_veg"   # 果菜
    MUSHROOM = "mushroom"     # きのこ類
    HERB = "herb"             # ハーブ
    OTHER = "other"           # その他
