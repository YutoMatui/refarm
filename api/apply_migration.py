import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    sql = """
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'farmers' AND column_name = 'selectable_days'
        ) THEN
            ALTER TABLE farmers ADD COLUMN selectable_days VARCHAR(100);
            COMMENT ON COLUMN farmers.selectable_days IS '選択可能曜日 (JSON: [0,1,2...])';
        END IF;
    END $$;
    """
    
    print("Executing SQL migration...")
    async with engine.begin() as conn:
        await conn.execute(text(sql))
    print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
