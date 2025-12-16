import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    sqls = [
        """
        ALTER TABLE farmers 
            ALTER COLUMN video_url TYPE JSONB USING 
            CASE 
                WHEN video_url IS NULL OR video_url = '' THEN '[]'::jsonb
                WHEN video_url LIKE '[%]' THEN video_url::jsonb
                ELSE jsonb_build_array(video_url)
            END;
        """,
        """
        ALTER TABLE farmers 
            ALTER COLUMN article_url TYPE JSONB USING 
            CASE 
                WHEN article_url IS NULL OR article_url = '' THEN '[]'::jsonb
                WHEN article_url LIKE '[%]' THEN article_url::jsonb
                ELSE jsonb_build_array(article_url)
            END;
        """
    ]
    
    print("Executing SQL migration (JSONB conversion)...")
    try:
        async with engine.begin() as conn:
            for sql in sqls:
                print(f"Executing: {sql.strip()[:50]}...")
                await conn.execute(text(sql))
        print("Migration completed successfully.")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
