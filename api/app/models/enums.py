"""
Enum definitions for database models.
"""
import enum


class FarmingMethod(str, enum.Enum):
    """栽培方法 (Farming Method)."""
    ORGANIC = "organic"         # 有機
    CONVENTIONAL = "conventional"  # 慣行


class HarvestStatus(str, enum.Enum):
    """収穫状況 (Harvest Status)."""
    HARVESTABLE = "harvestable"   # 🟢 現在収穫可能
    WAIT_1WEEK = "wait_1week"     # 🟡 1週間後に収穫可能
    WAIT_2WEEKS = "wait_2weeks"   # 🟠 2週間以上先に収穫可能
    ENDED = "ended"               # 🔴 数日以内に終了（または出荷停止）


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


class DeliverySlotType(str, enum.Enum):
    """B2C向け受取枠種別."""
    HOME = "HOME"  # 自宅配送
    UNIVERSITY = "UNIVERSITY"  # 兵庫県立大学 正門受取


class OrderStatus(str, enum.Enum):
    """注文ステータス (Order Status)."""
    PENDING = "PENDING"        # 受注待ち
    CONFIRMED = "CONFIRMED"    # 受注確定
    PREPARING = "PREPARING"    # 準備中
    SHIPPED = "SHIPPED"        # 配送中
    DELIVERED = "DELIVERED"    # 配達完了
    CANCELLED = "CANCELLED"    # キャンセル


class ProductCategory(str, enum.Enum):
    """商品カテゴリ (Product Category)."""
    LEAFY = "leafy"           # 葉物野菜
    ROOT = "root"             # 根菜
    FRUIT_VEG = "fruit_veg"   # 果菜
    MUSHROOM = "mushroom"     # きのこ類
    HERB = "herb"             # ハーブ
    OTHER = "other"           # その他


class ProcurementStatus(str, enum.Enum):
    """仕入れバッチステータス (Procurement Batch Status)."""
    COLLECTING = "COLLECTING"    # 注文受付中
    AGGREGATED = "AGGREGATED"    # 集計済み
    ORDERED = "ORDERED"          # 農家へ発注済み
    FULFILLED = "FULFILLED"      # 仕入れ完了
