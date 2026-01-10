import asyncio
import traceback
import sys
import os
from sqlalchemy import text
from app.core.database import engine

async def main():
    # delivery_schedulesテーブルにtime_slotカラムを追加するSQL
    sqls = [
        "ALTER TABLE delivery_schedules ADD COLUMN IF NOT EXISTS time_slot VARCHAR(50);"
    ]
    
    print("Executing SQL migration (Add time_slot column to delivery_schedules)...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql}")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    # カレントディレクトリをパスに追加してappモジュールを読み込めるようにする
    sys.path.append(os.getcwd())
    asyncio.run(main())
