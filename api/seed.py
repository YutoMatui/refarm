import asyncio
import logging
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import Restaurant, Farmer, Product, Favorite
from app.models.enums import StockType, TaxRate, ProductCategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    async with AsyncSessionLocal() as db:
        # 1. Create Restaurant
        logger.info("Seeding Restaurant...")
        # Check if exists
        stmt = select(Restaurant).where(Restaurant.line_user_id == "Uk-id-token")
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            logger.info("Restaurant already exists. Skipping.")
        else:
            restaurant = Restaurant(
                line_user_id="Uk-id-token", # Matches mock-id-token in liff.ts (last 10 chars)
                name="Refarm Demo Restaurant",
                phone_number="090-1234-5678",
                address="兵庫県神戸市中央区1-1-1",
                is_active=1
            )
            db.add(restaurant)
            await db.flush()
            logger.info(f"Created Restaurant: {restaurant.name}")
        
        # 2. Create Farmers
        logger.info("Seeding Farmers...")
        stmt = select(Farmer).limit(1)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
             logger.info("Farmers already exist. Skipping.")
             # Fetch existing farmers for product creation
             stmt = select(Farmer)
             result = await db.execute(stmt)
             farmers = result.scalars().all()
             farmer1 = farmers[0]
             farmer2 = farmers[1] if len(farmers) > 1 else farmers[0]
        else:
            farmer1 = Farmer(
                name="淡路島ファーム", 
                main_crop="たまねぎ",
                address="兵庫県淡路市",
                bio="淡路島で3代続く玉ねぎ農家です。",
                is_active=1
            )
            farmer2 = Farmer(
                name="六甲山農園", 
                main_crop="人参",
                address="兵庫県神戸市北区",
                bio="六甲山の麓で有機栽培を行っています。",
                is_active=1
            )
            db.add_all([farmer1, farmer2])
            await db.flush()
            logger.info("Created Farmers")
        
        # 3. Create Products
        logger.info("Seeding Products...")
        stmt = select(Product).limit(1)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            logger.info("Products already exist. Skipping.")
        else:
            p1 = Product(
                name="淡路島たまねぎ",
                description="甘くて美味しい淡路島の玉ねぎです。",
                price=100,
                tax_rate=TaxRate.REDUCED,
                stock_type=StockType.KOBE,
                category=ProductCategory.ROOT,
                farmer_id=farmer1.id,
                unit="個",
                is_active=1,
                stock_quantity=100
            )
            p2 = Product(
                name="六甲キャロット",
                description="雪の下で甘みを蓄えた人参です。",
                price=150,
                tax_rate=TaxRate.REDUCED,
                stock_type=StockType.OTHER,
                category=ProductCategory.ROOT,
                farmer_id=farmer2.id,
                unit="袋",
                is_active=1,
                stock_quantity=50
            )
            p3 = Product(
                name="朝採れレタス",
                description="シャキシャキの新鮮レタス。",
                price=200,
                tax_rate=TaxRate.REDUCED,
                stock_type=StockType.KOBE,
                category=ProductCategory.LEAFY,
                farmer_id=farmer1.id,
                unit="玉",
                is_active=1,
                stock_quantity=30
            )
            db.add_all([p1, p2, p3])
            await db.flush()
            logger.info("Created Products")

            # 4. Create Favorite (only if products were just created)
            # Need to get restaurant again if it was skipped
            if 'restaurant' not in locals():
                 stmt = select(Restaurant).where(Restaurant.line_user_id == "Uck-id-token")
                 result = await db.execute(stmt)
                 restaurant = result.scalar_one()

            logger.info("Seeding Favorites...")
            fav = Favorite(restaurant_id=restaurant.id, product_id=p1.id)
            db.add(fav)
            logger.info("Created Favorite")
        
        await db.commit()
        logger.info("Seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
