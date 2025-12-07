# Refarm EOS (Electronic Ordering System) v3.0

Production-grade full-stack application for restaurant vegetable ordering system.

## 🎯 Project Overview

**「深夜2時の事務作業を、明日の『武器』に変える」**

Refarm EOSは、飲食店向けの受発注システムで、神戸野菜と市場野菜のハイブリッド供給を実現します。

### Key Features

- **LINE LIFF連携**: LINE User IDによる自動ログイン
- **5つのタブ構成**:
  1. いつもの (History) - 過去注文頻度が高い商品
  2. お気に入り (Favorites) - 登録済み商品
  3. 野菜一覧 (Catalog) - 全商品表示・神戸野菜/その他の野菜を色分け
  4. 農家一覧 (Farmers) - 生産者紹介
  5. マイページ (My Page) - ユーザー情報管理
- **配送時間枠選択**: 12:00-14:00, 14:00-16:00, 16:00-18:00
- **価格スナップショット**: 注文時の価格を保持
- **ストーリーデリバリー**: 農家の動画・POP素材提供

## 🏗️ Architecture

```
webapp/
├── api/                    # Backend (FastAPI + PostgreSQL)
│   ├── app/
│   │   ├── core/          # Configuration & Database
│   │   ├── models/        # SQLAlchemy Models
│   │   ├── schemas/       # Pydantic Schemas
│   │   ├── routers/       # API Endpoints
│   │   └── main.py        # FastAPI Application
│   ├── migrations/        # Alembic Migrations
│   ├── requirements.txt
│   └── Dockerfile
├── client/                # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/   # Reusable Components
│   │   ├── pages/        # Page Components
│   │   ├── services/     # API Client
│   │   ├── store/        # Zustand State Management
│   │   ├── types/        # TypeScript Types
│   │   └── App.tsx
│   └── package.json
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd webapp
```

### 2. Start Backend with Docker

```bash
# Start PostgreSQL and FastAPI
docker-compose up -d

# View logs
docker-compose logs -f api

# Access API documentation
open http://localhost:8000/api/docs
```

### 3. Database Migration

```bash
# Generate initial migration
docker-compose exec api alembic revision --autogenerate -m "Initial schema"

# Apply migrations
docker-compose exec api alembic upgrade head
```

### 4. Start Frontend

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# Access application
open http://localhost:5173
```

## 📚 Technology Stack

### Backend

- **Framework**: FastAPI (Python 3.11)
- **ORM**: SQLAlchemy 2.0 (Async)
- **Database**: PostgreSQL 15
- **Migration**: Alembic
- **Validation**: Pydantic v2
- **Container**: Docker

### Frontend

- **Framework**: React 18
- **Language**: TypeScript 5
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **LINE Integration**: LIFF SDK

## 🗄️ Database Schema

### Tables

- **restaurants**: 飲食店情報 (LINE User ID連携)
- **farmers**: 生産者情報
- **products**: 商品情報 (神戸野菜/その他の野菜)
- **orders**: 注文情報 (配送日時指定)
- **order_items**: 注文明細 (価格スナップショット)
- **favorites**: お気に入り商品

## 🔌 API Endpoints

### Health Check

```
GET /health - Health check
GET / - API root
```

### Restaurants

```
POST   /api/restaurants - 飲食店登録
GET    /api/restaurants - 飲食店一覧
GET    /api/restaurants/{id} - 飲食店詳細
GET    /api/restaurants/line/{line_user_id} - LINE User IDで取得
PUT    /api/restaurants/{id} - 飲食店更新
DELETE /api/restaurants/{id} - 飲食店削除
```

### Products

```
POST   /api/products - 商品登録
GET    /api/products - 商品一覧 (絞り込み対応)
GET    /api/products/{id} - 商品詳細
PUT    /api/products/{id} - 商品更新
DELETE /api/products/{id} - 商品削除
```

### Orders

```
POST   /api/orders - 注文作成
GET    /api/orders - 注文一覧
GET    /api/orders/{id} - 注文詳細
PATCH  /api/orders/{id}/status - ステータス更新
DELETE /api/orders/{id} - 注文キャンセル
```

### Favorites

```
POST   /api/favorites/toggle - お気に入りトグル
GET    /api/favorites/restaurant/{id} - お気に入り一覧
GET    /api/favorites/check/{restaurant_id}/{product_id} - お気に入り状態確認
DELETE /api/favorites/{id} - お気に入り削除
```

## 🎨 UI/UX Design

### Color Scheme

- **神戸野菜 (Kobe Veggie)**: 緑色系 (Green theme)
  - 背景: `bg-kobe-100`
  - ボーダー: `border-kobe-500`
  - バッジ: `badge-kobe`

- **その他の野菜 (Other Veggie)**: 青色系 (Blue theme)
  - 背景: `bg-other-100`
  - ボーダー: `border-other-500`
  - バッジ: `badge-other`

### Mobile-First Design

- レスポンシブ対応
- タッチ操作最適化
- スマートフォン画面での使いやすさを重視

## 🧪 Testing

### Backend Testing

```bash
cd api
pytest
pytest --cov=app tests/
```

### Frontend Testing

```bash
cd client
npm run test
```

## 📝 Environment Variables

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://refarm:refarm_password@localhost:5432/refarm_eos
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
LIFF_ID=your-liff-id
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_LIFF_ID=your-liff-id
VITE_ENV=development
```

## 🚢 Deployment

### Production Deployment

1. **Database Migration**
   ```bash
   alembic upgrade head
   ```

2. **Backend Deployment**
   - Deploy to Cloud Run / AWS ECS / Railway
   - Configure environment variables
   - Set up PostgreSQL instance

3. **Frontend Deployment**
   ```bash
   cd client
   npm run build
   # Deploy dist/ to CDN / Vercel / Netlify
   ```

4. **LINE LIFF Setup**
   - Register LIFF app in LINE Developers Console
   - Configure endpoint URL
   - Update VITE_LIFF_ID

## 📖 Documentation

- **Backend API**: http://localhost:8000/api/docs
- **Database Schema**: `/api/README.md`
- **Frontend Components**: `/client/src/components/README.md`

## 🛠️ Development

### Backend Development

```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd client
npm install
npm run dev
```

### Docker Development

```bash
docker-compose up --build
```

## 🔒 Security

- Environment variables for sensitive data
- CORS configuration
- SQL injection prevention via SQLAlchemy
- Input validation via Pydantic
- XSS protection in React

## 📈 Performance Optimization

- Async database operations
- Connection pooling
- GZip compression
- React Query caching
- Lazy loading
- Code splitting

## 🐛 Troubleshooting

### Database Connection Issues

```bash
docker-compose down -v
docker-compose up -d
```

### Frontend Build Issues

```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

## 📜 License

Proprietary - Refarm EOS

## 👥 Team

- Backend: FastAPI + PostgreSQL
- Frontend: React + TypeScript
- Design: Tailwind CSS

---

## 📌 Current Status

**Version**: 3.0.0  
**Status**: ✅ **PRODUCTION READY**  
**Last Updated**: 2025-01-07

### ✅ Completed Features

#### Backend (FastAPI)
✅ Secure LINE LIFF authentication with ID Token verification  
✅ Complete database schema with 6 tables  
✅ RESTful API with full CRUD operations  
✅ Price snapshots for orders  
✅ Soft delete support  
✅ Alembic database migrations  
✅ Comprehensive API documentation (Swagger)  

#### Frontend (React + TypeScript)
✅ LINE LIFF SDK integration  
✅ 5-tab navigation (History, Favorites, Catalog, Farmers, MyPage)  
✅ Product catalog with Kobe/Other veggie color coding  
✅ Shopping cart with quantity management  
✅ Order creation with delivery date/time selection  
✅ Order completion page with story media links  
✅ Favorite products toggle functionality  
✅ Admin dashboard for product/farmer management  
✅ Responsive mobile-first design  

#### Security
✅ ID Token verification (prevents user impersonation)  
✅ Backend validates tokens with LINE's server  
✅ No direct LINE User ID transmission  
✅ CORS protection  
✅ SQL injection prevention (SQLAlchemy)  
✅ XSS protection (React)  

### 🚀 Ready for Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

---

**Contact**: development@refarm-eos.com
