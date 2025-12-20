import asyncio
import traceback
import os
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        # Products table
        """
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_wakeari INTEGER DEFAULT 0;
        """,
        """
        COMMENT ON COLUMN products.is_wakeari IS '訳ありフラグ (0: 通常, 1: 訳あり)';
        """
    ]
    
    print("Executing SQL migration (Add is_wakeari column)...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql.strip()}...")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure we are in the right directory or app is in path
    import sys
    sys.path.append(os.path.join(os.getcwd(), "app"))
    asyncio.run(main())
