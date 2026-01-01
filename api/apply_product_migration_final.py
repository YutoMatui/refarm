import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS variety VARCHAR(200);",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS farming_method VARCHAR(50);",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS weight INTEGER;",
        "COMMENT ON COLUMN products.variety IS '品種';",
        "COMMENT ON COLUMN products.farming_method IS '栽培方法 (organic:有機 / conventional:慣行)';",
        "COMMENT ON COLUMN products.weight IS '重量(g)';"
    ]
    
    print("Executing SQL migration for products table (variety, farming_method, weight)...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql}")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
