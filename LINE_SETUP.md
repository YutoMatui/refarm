# LINE Messaging API 設定ガイド

このドキュメントでは、LINE Messaging APIの設定方法を説明します。

## 📋 前提条件

- LINE Developersアカウント
- 作成済みのMessaging APIチャネル（レストラン用と生産者用の2つ）

## 🔑 必要な情報

### 1. レストラン用チャネル（消費者向け）
- Channel ID
- Channel Secret
- **Channel Access Token (long-lived)** ← 重要！

### 2. 生産者用チャネル
- Channel ID  
- Channel Secret
- **Channel Access Token (long-lived)** ← 重要！

### 3. テストユーザーのLINE User ID

## 🛠️ 設定手順

### Step 1: Channel Access Token の取得

1. LINE Developers コンソールにログイン
2. 対象のチャネルを選択
3. 「Messaging API」タブに移動
4. 「Channel access token (long-lived)」セクションで「Issue」ボタンをクリック
5. 発行されたトークンをコピー（後で使用）

### Step 2: 環境変数の設定

`api/.env` ファイルに以下の環境変数を追加：

```bash
# LINE Messaging API (Restaurant Channel)
LINE_RESTAURANT_CHANNEL_ID=your-channel-id
LINE_RESTAURANT_CHANNEL_SECRET=your-channel-secret
LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN=your-long-lived-access-token

# LINE Messaging API (Producer Channel)  
LINE_PRODUCER_CHANNEL_ID=your-channel-id
LINE_PRODUCER_CHANNEL_SECRET=your-channel-secret
LINE_PRODUCER_CHANNEL_ACCESS_TOKEN=your-long-lived-access-token

# LINE Test User IDs
LINE_TEST_USER_ID=your-test-user-id
LINE_CONSUMER_USER_ID=your-consumer-user-id
```

### Step 3: Webhook URLの設定（オプション）

もしWebhook（ユーザーからのメッセージ受信）を使用する場合：

1. LINE Developersコンソールで対象チャネルを選択
2. 「Messaging API」タブに移動
3. Webhook URLを設定: `https://your-domain.com/api/line/webhook`
4. 「Use webhook」を有効化

## 🧪 テスト方法

### 1. LINE User IDの取得

テスト用のLINE User IDを取得するには：

1. LINE Official Accountを友達追加
2. 何かメッセージを送信
3. Webhook経由でUser IDを取得
4. または、LIFFアプリで `liff.getProfile()` を使用

### 2. 注文テスト

1. フロントエンドから商品を注文
2. バックエンドログを確認して通知が送信されたか確認
3. LINEで通知が届いているか確認

## 📝 通知の種類

### 消費者向け通知（レストランチャネル使用）

1. **注文確認通知** (`notify_consumer_order`)
   - 注文完了時に消費者に送信
   - 注文内容、金額、受取情報を含む

2. **飲食店向け注文通知** (`notify_restaurant`)
   - B2B注文時に飲食店に送信
   - 注文明細と配送情報を含む

### 生産者向け通知（生産者チャネル使用）

1. **B2B注文通知** (`notify_farmers`)
   - 飲食店からの注文時
   - 各生産者に自分の商品の注文情報を送信

2. **B2C注文通知** (`notify_farmers_consumer_order`)
   - 一般消費者からの注文時  
   - 各生産者に自分の商品の注文情報を送信

## 🔍 トラブルシューティング

### エラー: "Invalid access token"

- Channel Access Tokenが正しいか確認
- トークンの有効期限が切れていないか確認（long-livedは無期限）
- 環境変数が正しく読み込まれているか確認

### エラー: "Invalid user ID"

- LINE User IDが正しいか確認
- ユーザーがOfficial Accountを友達追加しているか確認
- テスト環境では `LINE_TEST_USER_ID` にフォールバックされる

### 通知が届かない

1. バックエンドログを確認（エラーメッセージ）
2. LINE Developersコンソールでステータスを確認
3. Webhookが有効になっているか確認（必要な場合）
4. ユーザーがブロックしていないか確認

## 📚 参考資料

- [LINE Messaging API Reference](https://developers.line.biz/ja/reference/messaging-api/)
- [Channel Access Token](https://developers.line.biz/ja/docs/messaging-api/channel-access-tokens/)
- [Push Messages](https://developers.line.biz/ja/docs/messaging-api/sending-messages/#methods-of-sending-message)

## 🎯 本番環境での注意点

1. **長期トークンを使用**: 本番環境では `LINE_*_CHANNEL_ACCESS_TOKEN` に長期トークンを設定
2. **テストユーザーIDを削除**: 本番では `LINE_TEST_USER_ID` を空にして、実際のユーザーにのみ通知
3. **エラーハンドリング**: 通知失敗時でも注文処理を継続（バックグラウンドタスク）
4. **ログ監視**: LINE API呼び出しのエラーログを監視

## 💡 設定例（提供された情報を使用）

```bash
# 消費者向けチャネル（提供されたトークンを使用）
LINE_RESTAURANT_CHANNEL_ID=2008751355
LINE_RESTAURANT_CHANNEL_SECRET=92d720cf8a7d037a58b4cf5bc5e25115
LINE_RESTAURANT_CHANNEL_ACCESS_TOKEN=Jf7za5jmyPzScJ/gyTnUzG/Oe/6HTt+BCS8l8c07w1+dxNlLaJoK24EfCSjEoIuVT2vGKFc99+02JOi64IpyYZVdiAoY5T55SH/c0XGXcYwwqp7dC5Pg//bmRrPmk+G4Dw4eNqZSj0j3VGLPgmcDfAdB04t89/1O/w1cDnyilFU=

# テストユーザーID（提供されたUser ID）
LINE_TEST_USER_ID=Uf84a1f7dfb47a12c704d6ac8b438f873
LINE_CONSUMER_USER_ID=Uf84a1f7dfb47a12c704d6ac8b438f873
```

この設定で、消費者ID `Uf84a1f7dfb47a12c704d6ac8b438f873` (2007987539) に注文通知が送信されます。
