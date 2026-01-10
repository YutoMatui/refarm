import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    # Converted to PostgreSQL syntax
    statements = [
        """
        CREATE TABLE IF NOT EXISTS delivery_schedules (
            id SERIAL NOT NULL PRIMARY KEY,
            date DATE NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            procurement_staff VARCHAR(100),
            delivery_staff VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_delivery_schedules_date ON delivery_schedules (date)",
        "CREATE INDEX IF NOT EXISTS ix_delivery_schedules_id ON delivery_schedules (id)"
    ]
    
    print("Executing SQL migration for delivery_schedules (Postgres)...")
    try:
        async with engine.begin() as conn:
            for statement in statements:
                if statement.strip():
                    print(f"Executing: {statement.strip()[:50]}...")
                    await conn.execute(text(statement))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
