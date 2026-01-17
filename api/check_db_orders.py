
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import sys
import os

# app をパスに追加
sys.path.append(os.path.abspath('.'))

from app.core.config import settings
from app.models import Consumer, ConsumerOrder

async def check_db():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 消費者の確認
        stmt_c = select(Consumer)
        result_c = await session.execute(stmt_c)
        consumers = result_c.scalars().all()
        print(f"--- Consumers ({len(consumers)}) ---")
        for c in consumers:
            print(f"ID: {c.id}, Name: {c.name}, LINE ID: {c.line_user_id}")
            
        # 注文の確認
        stmt_o = select(ConsumerOrder)
        result_o = await session.execute(stmt_o)
        orders = result_o.scalars().all()
        print(f"\n--- Consumer Orders ({len(orders)}) ---")
        for o in orders:
            print(f"ID: {o.id}, ConsumerID: {o.consumer_id}, Status: {repr(o.status)}, Raw Value: {o.status.value if hasattr(o.status, 'value') else o.status}")

if __name__ == "__main__":
    asyncio.run(check_db())
