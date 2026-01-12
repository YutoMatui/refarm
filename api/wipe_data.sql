-- Wipe all transactional data for production launch
-- Preserves: Restaurants, Farmers, Products, Admins, Settings
-- Deletes: Orders, Visits, Logs, Notifications

BEGIN;

-- 1. Order Data (注文関連)
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- 2. Guest/Consumer Data (ゲスト機能関連)
TRUNCATE TABLE guest_interactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE guest_visits RESTART IDENTITY CASCADE;

-- 3. Analytics/Follows (フォロー情報もリセットしたい場合はコメントアウトを外す)
-- TRUNCATE TABLE farmer_follows RESTART IDENTITY CASCADE;

-- 4. Favorites (お気に入りもリセットしたい場合はコメントアウトを外す)
-- TRUNCATE TABLE favorites RESTART IDENTITY CASCADE;

COMMIT;
