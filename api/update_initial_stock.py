import sys
import os

# パスを通す
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.config import settings

def update_stock():
    # asyncpg は create_engine では使えないので psycopg2 に置換する (同期処理のため)
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    print(f"Connecting to database: {db_url}")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Check current stats
        result = conn.execute(text("SELECT count(*) FROM products WHERE stock_quantity IS NULL OR stock_quantity = 0"))
        count = result.scalar()
        print(f"Found {count} products with NULL or 0 stock.")
        
        if count > 0:
            # Update
            conn.execute(text("UPDATE products SET stock_quantity = 50 WHERE stock_quantity IS NULL OR stock_quantity = 0"))
            conn.commit()
            print("Updated stock_quantity to 50.")
        else:
            print("No products to update.")

if __name__ == "__main__":
    update_stock()
