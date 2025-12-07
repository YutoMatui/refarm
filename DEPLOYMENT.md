# Refarm EOS - デプロイメントガイド

## 🚀 本番環境デプロイ手順

### 1. 環境変数の設定

#### Backend (.env)

```env
# Database (Production PostgreSQL)
DATABASE_URL=postgresql+asyncpg://username:password@host:5432/refarm_eos

# Security
SECRET_KEY=your-production-secret-key-here-min-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS (Production frontend URL)
CORS_ORIGINS=https://liff.line.me,https://your-domain.com

# LINE LIFF (CRITICAL: Real LIFF ID)
LIFF_ID=your-real-liff-id-from-line-developers
LINE_CHANNEL_SECRET=your-channel-secret-from-line-developers

# Application
APP_NAME=Refarm EOS
APP_VERSION=3.0.0
DEBUG=False

# Timezone
TZ=Asia/Tokyo
```

#### Frontend (.env.production)

```env
# API Configuration (Production backend URL)
VITE_API_BASE_URL=https://api.your-domain.com/api

# LINE LIFF Configuration (CRITICAL)
VITE_LIFF_ID=your-real-liff-id-from-line-developers

# Environment
VITE_ENV=production
```

### 2. LINE Developers設定

#### 2.1 LIFFアプリ登録

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. チャネルを作成 (Messaging API)
3. LIFF アプリを追加:
   - **エンドポイントURL**: `https://your-domain.com`
   - **スコープ**: `profile`, `openid`
   - **Bot Link Feature**: オン (推奨)

4. **LIFF ID** と **Channel Secret** をコピーして環境変数に設定

#### 2.2 セキュリティ設定

- **ID Token検証**: バックエンドで自動的に実行 (`app/core/security.py`)
- **なりすまし防止**: フロントエンドからLINE User IDを直接送信しない
- **トークンフロー**:
  1. LIFF SDK が ID Token 取得
  2. フロントエンドがバックエンドに送信
  3. バックエンドがLINEサーバーに問い合わせて検証
  4. 検証成功後にLINE User IDを取得

### 3. データベースセットアップ

#### 3.1 PostgreSQL準備

```bash
# PostgreSQL インストール (例: Ubuntu)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# データベース作成
sudo -u postgres createdb refarm_eos
sudo -u postgres createuser refarm -P

# 権限付与
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE refarm_eos TO refarm;
\q
```

#### 3.2 マイグレーション実行

```bash
cd api

# Alembic初期化 (初回のみ)
alembic revision --autogenerate -m "Initial schema"

# マイグレーション適用
alembic upgrade head

# マイグレーション確認
alembic current
```

### 4. バックエンドデプロイ

#### Option A: Docker

```bash
# Dockerイメージビルド
docker build -t refarm-eos-api ./api

# コンテナ起動
docker run -d \
  --name refarm-api \
  -p 8000:8000 \
  --env-file api/.env \
  refarm-eos-api

# ログ確認
docker logs -f refarm-api
```

#### Option B: Cloud Run (推奨)

```bash
# Google Cloud Run にデプロイ
gcloud run deploy refarm-eos-api \
  --source ./api \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL,LIFF_ID=$LIFF_ID
```

#### Option C: Railway / Render

1. GitHubリポジトリを連携
2. 環境変数を設定
3. 自動デプロイ

### 5. フロントエンドデプロイ

#### 5.1 ビルド

```bash
cd client

# 依存関係インストール
npm install

# プロダクションビルド
npm run build

# ビルド確認
ls -lh dist/
```

#### 5.2 静的ホスティング

**Option A: Vercel**

```bash
npm install -g vercel
vercel --prod
```

**Option B: Netlify**

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Option C: Firebase Hosting**

```bash
firebase deploy --only hosting
```

### 6. 管理画面アクセス

管理画面は `/admin` パスでアクセス可能です。

**セキュリティ推奨事項:**
- Basic認証を追加
- IPアドレス制限
- 専用ドメインを設定

```nginx
# nginx設定例
location /admin {
    auth_basic "Refarm Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:5173/admin;
}
```

### 7. モニタリング設定

#### 7.1 ヘルスチェック

```bash
# API Health Check
curl https://api.your-domain.com/health

# Expected Response:
{
  "status": "healthy",
  "app": "Refarm EOS",
  "version": "3.0.0"
}
```

#### 7.2 ログ監視

- **バックエンド**: CloudWatch / Stackdriver
- **フロントエンド**: Sentry / LogRocket
- **データベース**: pgAdmin / DataDog

### 8. バックアップ戦略

#### データベースバックアップ

```bash
# 毎日自動バックアップ (cron)
0 2 * * * pg_dump refarm_eos > /backups/refarm_$(date +\%Y\%m\%d).sql
```

#### ファイルバックアップ

- 環境変数ファイル
- Alembicマイグレーション
- 設定ファイル

### 9. スケーリング戦略

#### データベース

- **読み取りレプリカ**: 注文履歴照会用
- **コネクションプーリング**: PgBouncer
- **インデックス最適化**: 主要クエリに対して

#### アプリケーション

- **水平スケーリング**: Kubernetes / Cloud Run
- **CDN**: CloudFlare / Fastly
- **キャッシング**: Redis

### 10. トラブルシューティング

#### 問題: LIFF認証失敗

```bash
# バックエンドログ確認
docker logs refarm-api | grep "LINE"

# 原因:
- LIFF IDが間違っている
- Channel Secretが間違っている
- LINEサーバーとの通信エラー
```

#### 問題: データベース接続エラー

```bash
# PostgreSQL接続テスト
psql -h hostname -U refarm -d refarm_eos

# マイグレーション状態確認
alembic current
alembic history
```

#### 問題: CORS エラー

```python
# api/app/core/config.py
CORS_ORIGINS = "https://liff.line.me,https://your-domain.com"
```

### 11. セキュリティチェックリスト

- [ ] 環境変数を `.env` に保存 (コミットしない)
- [ ] SECRET_KEY を32文字以上のランダム文字列に変更
- [ ] DATABASE_URL のパスワードを強力なものに変更
- [ ] DEBUG=False に設定
- [ ] HTTPS を有効化
- [ ] CORS設定を本番ドメインのみに制限
- [ ] API Rate Limiting を設定
- [ ] SQLインジェクション対策 (SQLAlchemy使用で自動)
- [ ] XSS対策 (React使用で自動)
- [ ] 管理画面に認証を追加

### 12. パフォーマンス最適化

#### フロントエンド

- [ ] Code Splitting
- [ ] Lazy Loading
- [ ] Image Optimization
- [ ] Service Worker (PWA)

#### バックエンド

- [ ] Database Query Optimization
- [ ] API Response Caching
- [ ] GZip Compression (実装済み)
- [ ] Connection Pooling

---

## 📞 サポート

デプロイに関する問題は以下にお問い合わせください:

- **Email**: support@refarm-eos.com
- **GitHub Issues**: https://github.com/your-org/refarm-eos/issues

---

**Last Updated**: 2025-01-07  
**Version**: 3.0.0
