import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        # Restaurants table
        """
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude VARCHAR(50);
        """,
        """
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude VARCHAR(50);
        """,
        """
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_window_start VARCHAR(5);
        """,
        """
        ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_window_end VARCHAR(5);
        """,
        # Farmers table
        """
        ALTER TABLE farmers ADD COLUMN IF NOT EXISTS latitude VARCHAR(50);
        """,
        """
        ALTER TABLE farmers ADD COLUMN IF NOT EXISTS longitude VARCHAR(50);
        """
    ]
    
    print("Executing SQL migration (Add location columns)...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql.strip()}...")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
