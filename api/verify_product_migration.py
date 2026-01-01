import asyncio
import traceback
from sqlalchemy import text
from app.core.database import engine

async def main():
    print("Verifying products table columns...")
    try:
        async with engine.begin() as conn:
            # Check specific columns
            result = await conn.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'products' 
                ORDER BY column_name;
            """))
            columns = result.fetchall()
            print("Columns in 'products' table:")
            found_target = []
            for col in columns:
                print(f"- {col[0]}: {col[1]}")
                if col[0] in ('variety', 'farming_method', 'weight'):
                    found_target.append(col[0])
            
            print(f"\nTarget columns found: {found_target}")
            if len(found_target) == 3:
                print("SUCCESS: All target columns are present.")
            else:
                print(f"FAILURE: Only found {len(found_target)}/3 target columns.")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
