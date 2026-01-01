from decimal import Decimal, ROUND_HALF_UP

def calculate_retail_price(cost_price: float | int | Decimal) -> Decimal:
    """
    卸値から販売価格を計算する。
    計算式: 卸値 / 0.7
    丸め: 1の位を四捨五入（10円単位にする）
    """
    if not cost_price:
        return Decimal(0)
    
    # 卸値 / 0.7
    raw_price = Decimal(str(cost_price)) / Decimal("0.7")
    
    # 1の位を四捨五入して10円単位に。
    # -1 は 10^1 の位で丸めることを意味する。
    # 123 -> 120, 125 -> 130
    return raw_price.quantize(Decimal("1E1"), rounding=ROUND_HALF_UP)
