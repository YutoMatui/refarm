from decimal import Decimal, ROUND_HALF_UP
import json
import os

def get_price_multiplier() -> Decimal:
    """設定ファイルから価格係数を取得 (デフォルト0.7)"""
    try:
        # Note: Since this is called from api app, path is relative to root
        path = "app/data/general_settings.json"
        if os.path.exists(path):
            with open(path, "r") as f:
                data = json.load(f)
                val = data.get("default_price_multiplier")
                if val:
                    return Decimal(str(val))
    except Exception:
        pass
    return Decimal("0.7")

def calculate_retail_price(cost_price: float | int | Decimal) -> Decimal:
    """
    卸値から販売価格を計算する。
    計算式: 卸値 / 係数 (設定可能、デフォルト0.7)
    丸め: 1の位を四捨五入（10円単位にする）
    """
    if not cost_price:
        return Decimal(0)
    
    # 卸値 / 係数
    multiplier = get_price_multiplier()
    if multiplier == 0:
        multiplier = Decimal("0.7") # prevent division by zero
        
    raw_price = Decimal(str(cost_price)) / multiplier
    
    # 1の位を四捨五入して10円単位に。
    # -1 は 10^1 の位で丸めることを意味する。
    # 123 -> 120, 125 -> 130
    return raw_price.quantize(Decimal("1E1"), rounding=ROUND_HALF_UP)
