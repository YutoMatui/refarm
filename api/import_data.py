import asyncio
import csv
import os
import sys
from decimal import Decimal

# パス設定
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal, init_db
from app.models.farmer import Farmer
from app.models.product import Product
from app.models.enums import StockType, ProductCategory, TaxRate

CSV_PATH = "/home/user/webapp/spreadsheet_data.csv"

def estimate_category(name: str) -> ProductCategory:
    name = name.lower()
    leafy_keywords = ["レタス", "小松菜", "水菜", "キクナ", "菊菜", "コカブ", "菜", "ネギ", "ねぎ", "ブロッコリー", "キャベツ", "ほうれん草", "パクチー", "葉", "セロリ", "春菊"]
    root_keywords = ["さつまいも", "人参", "大根", "カブ", "かぶ", "じゃがいも", "キクイモ", "サトイモ", "ラディッシュ", "にんにく", "芋", "出島", "レッドムーン"]
    fruit_keywords = ["南瓜", "冬瓜", "柿", "瓜", "トマト", "なす", "ピーマン", "オクラ", "唐辛子", "鷹の爪", "梅干し"]
    mushroom_keywords = ["しいたけ", "キノコ"]

    if any(k in name for k in leafy_keywords):
        return ProductCategory.LEAFY
    if any(k in name for k in root_keywords):
        return ProductCategory.ROOT
    if any(k in name for k in fruit_keywords):
        return ProductCategory.FRUIT_VEG
    if any(k in name for k in mushroom_keywords):
        return ProductCategory.MUSHROOM
    
    return ProductCategory.OTHER

async def import_data():
    if not os.path.exists(CSV_PATH):
        print(f"File not found: {CSV_PATH}")
        return

    print("Starting import...")
    
    # Initialize DB (create tables if not exists)
    await init_db()
    
    async with AsyncSessionLocal() as session:
        # 既存の農家を取得してキャッシュ
        farmers_map = {} # name -> id
        result = await session.execute(select(Farmer))
        existing_farmers = result.scalars().all()
        for f in existing_farmers:
            farmers_map[f.name] = f
            
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # 必要なカラム: 野菜名, 品種, 規格（１パックの重さ）, 農家名, 販売価格, 仕入れ可能か, 備考, 有機or慣行
                vege_name = row.get('野菜名')
                farmer_name = row.get('農家名')
                price_str = row.get('販売価格')
                
                if not vege_name or not farmer_name or not price_str:
                    continue
                    
                # 価格のパース (数値でない場合はスキップ)
                try:
                    price = Decimal(price_str)
                except:
                    # 空白や文字列の場合はスキップ
                    continue

                # 農家の処理
                farmer = farmers_map.get(farmer_name)
                if not farmer:
                    print(f"Creating new farmer: {farmer_name}")
                    farmer = Farmer(
                        name=farmer_name,
                        bio="神戸の新鮮な野菜を届ける農家です。",
                        is_active=1
                    )
                    session.add(farmer)
                    await session.flush() # ID取得のため
                    farmers_map[farmer_name] = farmer
                
                # 商品情報の構築
                variety = row.get('品種', '')
                spec = row.get('規格（１パックの重さ）', '')
                is_available_str = row.get('仕入れ可能か', '')
                memo = row.get('備考', '')
                organic_type = row.get('有機or慣行', '')
                
                description = []
                if variety: description.append(f"品種: {variety}")
                if organic_type: description.append(f"栽培: {organic_type}")
                if memo: description.append(f"備考: {memo}")
                if is_available_str: description.append(f"状況: {is_available_str}")
                
                full_description = "\n".join(description)
                
                # 在庫/アクティブ判定
                is_active = 1 if "現在収穫中" in is_available_str else 0
                
                # カテゴリ推定
                category = estimate_category(vege_name)
                
                # 商品作成
                product = Product(
                    farmer_id=farmer.id,
                    name=vege_name,
                    description=full_description,
                    price=price,
                    unit=spec if spec else "個",
                    stock_type=StockType.KOBE,
                    category=category,
                    is_active=is_active,
                    image_url=None, # 写真なし
                    stock_quantity=100 if is_active else 0, # 仮の在庫
                    tax_rate=TaxRate.REDUCED
                )
                session.add(product)
                print(f"Added product: {vege_name} from {farmer_name}")
        
        await session.commit()
        print("Import completed!")

if __name__ == "__main__":
    from sqlalchemy import select
    asyncio.run(import_data())
