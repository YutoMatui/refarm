import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    print("Verifying invitation columns...")
    try:
        async with engine.begin() as conn:
            for table in ['farmers', 'restaurants']:
                print(f"\nChecking table: {table}")
                result = await conn.execute(text(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' 
                    AND column_name IN ('invite_token', 'invite_code', 'invite_expires_at');
                """))
                columns = result.fetchall()
                found = []
                for col in columns:
                    print(f"- {col[0]}: {col[1]}")
                    found.append(col[0])
                
                if len(found) == 3:
                    print(f"SUCCESS: All invitation columns present in {table}.")
                else:
                    print(f"FAILURE: Missing columns in {table}. Found only {found}.")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
