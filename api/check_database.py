"""
Check database tables and structure
"""
import asyncio
from sqlalchemy import inspect, text
from app.core.database import engine
from app.core.config import settings


async def check_tables():
    """Check all tables in the database"""
    print(f"Checking database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'local'}")
    print("-" * 80)
    
    async with engine.begin() as conn:
        # Get all table names
        tables = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
        
        print(f"\n✅ Found {len(tables)} tables:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        # Check for delivery_slots specifically
        print("\n" + "=" * 80)
        if 'delivery_slots' in tables:
            print("✅ delivery_slots table EXISTS")
            
            # Check enum type
            result = await conn.execute(
                text("SELECT enum_range(NULL::deliveryslottype);")
            )
            enum_values = result.scalar()
            print(f"   Enum values: {enum_values}")
            
            # Check columns
            columns = await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_columns('delivery_slots')
            )
            print(f"   Columns ({len(columns)}):")
            for col in columns:
                print(f"     - {col['name']}: {col['type']}")
                
            # Count records
            count_result = await conn.execute(
                text("SELECT COUNT(*) FROM delivery_slots;")
            )
            count = count_result.scalar()
            print(f"   Records: {count}")
            
        else:
            print("❌ delivery_slots table DOES NOT EXIST")
            print("\n⚠️  This table is REQUIRED for consumer orders!")
            print("\n📋 To create the table, run:")
            print("   cd /home/user/webapp/api")
            print("   alembic upgrade head")
            print("\n   Or create manually using the SQL in DATABASE_TABLES.md")
        
        print("=" * 80)
        
        # Check other critical tables
        critical_tables = [
            'consumers',
            'consumer_orders',
            'consumer_order_items',
            'support_messages',
            'farmers',
            'products'
        ]
        
        print("\n🔍 Critical tables check:")
        for table in critical_tables:
            status = "✅" if table in tables else "❌"
            print(f"  {status} {table}")


if __name__ == "__main__":
    asyncio.run(check_tables())
