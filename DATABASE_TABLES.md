# Refarm データベーステーブル一覧

## 本来あるべきDBテーブル (2026-01-17時点)

### 1. 管理者・認証関連
- **`admins`** - 管理者ユーザー
  - id, email, hashed_password, name, role, is_active, created_at, updated_at

### 2. 生産者・農家関連
- **`farmers`** - 生産者情報
  - id, name, bio, profile_photo_url, cover_photo_url, location, email, phone
  - video_url, article_url, kodawari, farming_method, certifications
  - commitments (JSON), achievements (JSON)
  - created_at, updated_at

- **`products`** - 商品情報
  - id, farmer_id (FK), name, description, unit, price, price_with_tax
  - stock_quantity, category, stock_type (KOBE/OTHER)
  - is_active, is_featured, is_wakeari, image_url, harvest_status
  - created_at, updated_at

### 3. 飲食店関連
- **`restaurants`** - 飲食店情報
  - id, name, address, phone, email, contact_person
  - is_active, created_at, updated_at

- **`orders`** - 飲食店からの注文 (B2B)
  - id, restaurant_id (FK), delivery_date, delivery_time_slot
  - total_amount, status (PENDING/CONFIRMED/PREPARING/SHIPPED/DELIVERED/CANCELLED)
  - notes, created_at, updated_at

- **`order_items`** - 注文明細 (暗黙的な中間テーブル)
  - order_id (FK), product_id (FK), quantity, price_at_order
  - created_at

### 4. 消費者関連 (B2C)
- **`consumers`** - 消費者情報
  - id, line_user_id (unique), name, email, phone
  - address, building, postal_code
  - is_active, created_at, updated_at

- **`consumer_orders`** - 消費者からの注文
  - id, consumer_id (FK), delivery_slot_id (FK)
  - delivery_address, delivery_notes, order_notes
  - total_amount, status, received_at
  - created_at, updated_at

- **`consumer_order_items`** - 消費者注文明細
  - id, consumer_order_id (FK), product_id (FK)
  - quantity, price_at_order
  - created_at

- **`support_messages`** - 応援メッセージ
  - id, consumer_id (FK), farmer_id (FK)
  - message (Text), nickname (optional)
  - created_at

### 5. 配送スケジュール関連
- **`delivery_schedules`** - 飲食店向け配送スケジュール (B2B)
  - id, delivery_date, time_slot (12-14/14-16/16-18)
  - point_time, is_active, note
  - created_at, updated_at

- **`delivery_slots`** - 消費者向け受取枠 (B2C) ⚠️ 重要
  - id, date, slot_type (HOME/UNIV)
  - start_time, end_time, time_text
  - is_active, note
  - created_at, updated_at

### 6. その他
- **`favorites`** - お気に入り（生産者フォロー）
  - id, consumer_id (FK), farmer_id (FK)
  - created_at

- **`analytics`** - アクセス解析
  - id, event_type, user_type, reference_id
  - metadata (JSON), created_at

- **`guests`** - ゲストユーザー（開発/デモ用）
  - id, access_code, email, name
  - is_active, expires_at
  - created_at, updated_at

## テーブルの確認方法

### 方法1: Alembicマイグレーション経由（推奨）
```bash
cd /home/user/webapp/api
alembic upgrade head
```

### 方法2: psqlで直接確認（PostgreSQLの場合）
```bash
psql $DATABASE_URL
\dt  # テーブル一覧表示
\d delivery_slots  # delivery_slotsテーブルの構造確認
```

### 方法3: Pythonスクリプトで確認
```python
# api/check_tables.py
import asyncio
from sqlalchemy import inspect
from app.core.database import engine

async def check_tables():
    async with engine.begin() as conn:
        result = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
        print("Existing tables:", result)
        
asyncio.run(check_tables())
```

## delivery_slotsテーブルが存在しない場合の対処

### 1. Alembicマイグレーションの作成
```bash
cd /home/user/webapp/api
alembic revision --autogenerate -m "Add delivery_slots table"
alembic upgrade head
```

### 2. 手動でテーブル作成（緊急時）
```sql
CREATE TYPE deliveryslottype AS ENUM ('HOME', 'UNIV');

CREATE TABLE delivery_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    slot_type deliveryslottype NOT NULL,
    start_time TIME,
    end_time TIME,
    time_text VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX ix_delivery_slots_date_type ON delivery_slots(date, slot_type);
```

## enum型の確認と修正

### 現在のenum値を確認
```sql
SELECT enum_range(NULL::deliveryslottype);
```

### enum型が'UNIVERSITY'になっている場合の修正
```sql
-- 既存のenum型を削除して再作成
ALTER TABLE delivery_slots ALTER COLUMN slot_type TYPE VARCHAR(20);
DROP TYPE IF EXISTS deliveryslottype;
CREATE TYPE deliveryslottype AS ENUM ('HOME', 'UNIV');
ALTER TABLE delivery_slots ALTER COLUMN slot_type TYPE deliveryslottype USING slot_type::deliveryslottype;
```

## 重要な注意事項

1. **delivery_slots テーブルは必須**
   - 消費者向けの受取日時選択に使用
   - LocalCartコンポーネントがこのテーブルに依存

2. **enum型の値は 'UNIV' であること**
   - データベース: `'HOME'`, `'UNIV'`
   - Python enum: `HOME = "HOME"`, `UNIVERSITY = "UNIV"`
   - TypeScript enum: `HOME = 'HOME'`, `UNIVERSITY = 'UNIV'`

3. **インデックスの作成**
   - `(date, slot_type)` の複合インデックスが必要
   - パフォーマンス向上のため

4. **リレーション**
   - `consumer_orders.delivery_slot_id` → `delivery_slots.id` (FK)

## トラブルシューティング

### 500エラーが出る場合
1. テーブルが存在するか確認
2. enum型の値が正しいか確認
3. 外部キー制約が正しく設定されているか確認

### マイグレーションが失敗する場合
1. データベース接続を確認
2. 既存データとの競合を確認
3. 手動でテーブルを作成後、Alembicのバージョンを更新

```bash
alembic stamp head
```
