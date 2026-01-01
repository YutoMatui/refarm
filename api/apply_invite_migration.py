import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        "ALTER TABLE farmers ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);",
        "ALTER TABLE farmers ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10);",
        "ALTER TABLE farmers ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;",
        "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);",
        "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10);",
        "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;",
        "CREATE INDEX IF NOT EXISTS ix_farmers_invite_token ON farmers (invite_token);",
        "CREATE INDEX IF NOT EXISTS ix_restaurants_invite_token ON restaurants (invite_token);"
    ]
    
    print("Executing SQL migration for invitation columns (farmers and restaurants)...")
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
