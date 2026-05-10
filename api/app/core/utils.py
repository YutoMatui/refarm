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

def calculate_retail_price(cost_price: float | int | Decimal, multiplier: Decimal | float | None = None) -> Decimal:
    """
    卸値から販売価格（税抜）を計算する。
    計算式: 卸値 / 係数
    """
    if not cost_price:
        return Decimal(0)

    if multiplier is None or Decimal(str(multiplier)) == 0:
        multiplier = get_price_multiplier()
    else:
        multiplier = Decimal(str(multiplier))

    raw_price = Decimal(str(cost_price)) / multiplier
    return raw_price.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
