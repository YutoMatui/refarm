import asyncio
import traceback
import os
import sys
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        # Drop is_outlet column
        "ALTER TABLE products DROP COLUMN IF EXISTS is_outlet;"
    ]
    
    print("Executing SQL to drop is_outlet column...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql}")
                await conn.execute(text(sql))
        print("SQL execution completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure we are in the right directory or app is in path
    sys.path.append(os.getcwd())
    asyncio.run(main())
