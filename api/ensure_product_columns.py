import asyncio
import traceback
import os
import sys
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        # variety
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS variety VARCHAR(200);",
        "COMMENT ON COLUMN products.variety IS '品種';",
        
        # farming_method
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS farming_method VARCHAR(50);",
        "COMMENT ON COLUMN products.farming_method IS '栽培方法 (organic:有機 / conventional:慣行)';",
        
        # weight
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS weight INTEGER;",
        "COMMENT ON COLUMN products.weight IS '重量(g)';",
        
        # cost_price
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER;",
        "COMMENT ON COLUMN products.cost_price IS '仕入れ値';",
        
        # harvest_status
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_status VARCHAR(50);",
        "COMMENT ON COLUMN products.harvest_status IS '収穫状況';",
        
        # is_wakeari
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_wakeari INTEGER DEFAULT 0;",
        "COMMENT ON COLUMN products.is_wakeari IS '訳ありフラグ (0: 通常, 1: 訳あり)';",
        
        # is_active (ensure exists)
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;",
        
        # is_featured (ensure exists)
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INTEGER DEFAULT 0;",

        # Cleanup: Add is_outlet if missing just to prevent breakage in case some old code still uses it, 
        # or just ignore it if we are sure we'll fix it everywhere.
        # But wait, better to unify.
    ]
    
    print("Executing consolidated SQL migration for products table...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql}")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure we are in the right directory or app is in path
    sys.path.append(os.getcwd())
    asyncio.run(main())
