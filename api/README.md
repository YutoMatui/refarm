# Refarm EOS API - Backend

Production-grade FastAPI backend for restaurant ordering system.

## 🚀 Features

- **FastAPI**: High-performance async API framework
- **SQLAlchemy 2.0**: Async ORM with type safety
- **PostgreSQL**: Production-ready database
- **Alembic**: Database migration management
- **Pydantic**: Data validation and serialization
- **Docker**: Containerized development environment

## 📋 Prerequisites

- Docker & Docker Compose
- Python 3.11+
- PostgreSQL 15+

## 🛠️ Setup & Installation

### 1. Environment Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start with Docker Compose

```bash
# Start all services (PostgreSQL + API)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### 3. Database Migrations

```bash
# Generate initial migration
docker-compose exec api alembic revision --autogenerate -m "Initial schema"

# Apply migrations
docker-compose exec api alembic upgrade head

# Rollback migration
docker-compose exec api alembic downgrade -1
```

### 4. Local Development (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL (separate terminal)
docker-compose up postgres -d

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📚 API Documentation

Once the server is running, access:

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **Health Check**: http://localhost:8000/health

## 🗄️ Database Schema

### Tables

- **restaurants**: 飲食店情報 (LINE User ID連携)
- **farmers**: 生産者情報
- **products**: 商品情報 (神戸野菜 / その他の野菜)
- **orders**: 注文情報 (配送日時指定)
- **order_items**: 注文明細 (価格スナップショット)
- **favorites**: お気に入り商品

### Key Features

- **Soft Delete**: All tables support soft deletion
- **Timestamps**: Auto-managed created_at/updated_at
- **Enum Types**: Type-safe enums for status fields
- **Price Snapshots**: Order items preserve historical prices

## 🔌 API Endpoints

### Restaurants (飲食店)

```
POST   /api/restaurants          - 飲食店登録
GET    /api/restaurants          - 飲食店一覧
GET    /api/restaurants/{id}     - 飲食店詳細
GET    /api/restaurants/line/{line_user_id} - LINE User IDで取得
PUT    /api/restaurants/{id}     - 飲食店更新
DELETE /api/restaurants/{id}     - 飲食店削除
```

### Farmers (生産者)

```
POST   /api/farmers              - 生産者登録
GET    /api/farmers              - 生産者一覧
GET    /api/farmers/{id}         - 生産者詳細
PUT    /api/farmers/{id}         - 生産者更新
DELETE /api/farmers/{id}         - 生産者削除
```

### Products (商品)

```
POST   /api/products             - 商品登録
GET    /api/products             - 商品一覧 (絞り込み対応)
GET    /api/products/{id}        - 商品詳細
PUT    /api/products/{id}        - 商品更新
DELETE /api/products/{id}        - 商品削除
```

### Orders (注文)

```
POST   /api/orders               - 注文作成
GET    /api/orders               - 注文一覧
GET    /api/orders/{id}          - 注文詳細
PATCH  /api/orders/{id}/status   - ステータス更新
DELETE /api/orders/{id}          - 注文キャンセル
```

### Favorites (お気に入り)

```
POST   /api/favorites/toggle     - お気に入りトグル
GET    /api/favorites/restaurant/{id} - 飲食店のお気に入り一覧
GET    /api/favorites/check/{restaurant_id}/{product_id} - お気に入り状態確認
DELETE /api/favorites/{id}       - お気に入り削除
```

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_restaurants.py
```

## 📦 Project Structure

```
api/
├── app/
│   ├── core/              # Core configuration
│   │   ├── config.py      # Settings management
│   │   └── database.py    # Database connection
│   ├── models/            # SQLAlchemy models
│   │   ├── base.py        # Base model mixins
│   │   ├── enums.py       # Enum definitions
│   │   ├── restaurant.py  # Restaurant model
│   │   ├── farmer.py      # Farmer model
│   │   ├── product.py     # Product model
│   │   ├── order.py       # Order & OrderItem models
│   │   └── favorite.py    # Favorite model
│   ├── schemas/           # Pydantic schemas
│   │   ├── base.py        # Base schemas
│   │   ├── restaurant.py  # Restaurant schemas
│   │   ├── farmer.py      # Farmer schemas
│   │   ├── product.py     # Product schemas
│   │   ├── order.py       # Order schemas
│   │   └── favorite.py    # Favorite schemas
│   ├── routers/           # API routers
│   │   ├── restaurants.py # Restaurant endpoints
│   │   ├── farmers.py     # Farmer endpoints
│   │   ├── products.py    # Product endpoints
│   │   ├── orders.py      # Order endpoints
│   │   └── favorites.py   # Favorite endpoints
│   └── main.py            # FastAPI application
├── migrations/            # Alembic migrations
├── tests/                 # Test files
├── .env                   # Environment variables
├── .env.example           # Environment template
├── requirements.txt       # Python dependencies
├── Dockerfile             # Docker image
└── alembic.ini           # Alembic configuration
```

## 🔒 Security

- Environment variables for sensitive data
- CORS configuration for frontend access
- Password hashing (if authentication is added)
- SQL injection prevention via SQLAlchemy
- Input validation via Pydantic

## 📈 Performance

- Async database operations
- Connection pooling (10 base + 20 overflow)
- GZip compression for responses
- Query optimization with indexes
- Pagination for list endpoints

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Recreate database
docker-compose down -v
docker-compose up -d
```

### Migration Issues

```bash
# Reset migrations
docker-compose exec api alembic downgrade base
docker-compose exec api alembic upgrade head

# Generate new migration
docker-compose exec api alembic revision --autogenerate -m "description"
```

## 📝 License

Proprietary - Refarm EOS

## 👥 Contributors

- Development Team
