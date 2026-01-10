import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    sql = """
    CREATE TABLE IF NOT EXISTS delivery_schedules (
        id SERIAL NOT NULL,
        date DATE NOT NULL,
        is_available BOOLEAN NOT NULL,
        procurement_staff VARCHAR(100),
        delivery_staff VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        PRIMARY KEY (id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_delivery_schedules_date ON delivery_schedules (date);
    CREATE INDEX IF NOT EXISTS ix_delivery_schedules_id ON delivery_schedules (id);
    """
    
    print("Executing SQL migration for delivery_schedules...")
    try:
        async with engine.begin() as conn:
            await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
