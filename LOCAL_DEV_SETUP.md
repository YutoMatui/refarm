# 消費者画面(/local)開発モード設定

## 📝 修正概要

/localにアクセスした際のLINEログイン機能を一時的に無効化し、誰でも消費者向け画面を確認できるようにしました。

## 🔧 修正したファイル

### 1. `client/src/pages/local/LocalApp.tsx`

#### 変更内容:
- **開発モードフラグ追加**: `SKIP_LINE_LOGIN = true` を設定
- **LINEログインスキップ機能**: 開発モード時はLIFF初期化をスキップしてダミーデータで進行
- **初回ログイン対応**: DBにユーザーが存在しない場合、自動的に登録フォームを表示
- **エラーハンドリング改善**: 認証エラー(404/401)が発生した場合も登録フォームを表示

#### 主要な変更点:
```typescript
// 一時的な開発モード設定(LINEログインをスキップ)
const SKIP_LINE_LOGIN = true // 開発確認用: LINEログインを無効化

// SKIP_LINE_LOGINがtrueの場合、LIFF初期化をスキップして
// ダミーのlineUserIdとidTokenで登録フォームを表示
if (SKIP_LINE_LOGIN) {
    console.log('🔧 開発モード: LINEログインをスキップしています')
    setLineUserId('dev-user-id')
    setUserRole('consumer')
    setRestaurant(null)
    setFarmer(null)
    setConsumer(null)
    clearCart()
    setIdToken('dev-token')
    setNeedsRegistration(true)
    setLoading(false)
    return
}
```

### 2. `client/src/pages/local/ConsumerRegisterForm.tsx`

#### 変更内容:
- **開発モード対応**: idTokenが`dev-token`の場合、ダミー消費者データで登録成功させる
- **バリデーション改善**: 必須項目チェックをフォーム送信時の最初に実行

#### 主要な変更点:
```typescript
// 開発用: idTokenがdev-tokenの場合はダミーデータで成功させる
if (idToken === 'dev-token') {
    console.log('🔧 開発モード: ダミー登録データで進めます')
    const dummyConsumer: Consumer = {
        id: 9999,
        line_user_id: 'dev-user-id',
        name,
        phone_number: phoneNumber,
        postal_code: sanitizePostalCode(postalCode),
        address,
        building: building || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
    await new Promise(resolve => setTimeout(resolve, 500)) // 少し待機
    toast.success('会員登録が完了しました(開発モード)')
    onSuccess(dummyConsumer)
    return
}
```

## 🚀 使用方法

### 1. 開発サーバーを起動

```bash
cd /home/user/webapp/client
npm install
npm run dev
```

### 2. ブラウザでアクセス

開発サーバー起動後、以下のURLにアクセス:

**ローカル**: http://localhost:5173/local
**公開URL**: https://5173-itrjh4oj58vqnhxapymd7-d0b9e1e2.sandbox.novita.ai/local

### 3. 画面の動作確認

1. `/local`にアクセスすると、LINEログイン画面は表示されず、**直接会員登録フォームが表示**されます
2. フォームに以下の情報を入力:
   - お名前(フルネーム)
   - 電話番号(緊急連絡先)
   - 郵便番号(7桁)
   - 住所(都道府県・市区町村・番地)
   - 建物名・部屋番号(任意)
3. 「会員登録する」ボタンをクリック
4. **開発モードでは、ダミーデータで登録が完了**し、商品一覧画面が表示されます

### 4. 画面構成

登録完了後は以下の画面が利用可能:

- **商品一覧** (`/local`): 購入可能な野菜の一覧
- **カート** (`/local/cart`): 選択した商品の確認と注文
- **登録情報** (`/local/profile`): 配送先情報の確認・変更

## 📌 注意事項

### 開発モードの有効化/無効化

**開発モード(LINEログインスキップ)を無効化する場合:**

`client/src/pages/local/LocalApp.tsx` の以下の行を変更:

```typescript
// 開発モードを無効化
const SKIP_LINE_LOGIN = false
```

### 本番環境への適用

本番環境にデプロイする際は、**必ず `SKIP_LINE_LOGIN = false` に設定してください。**

開発モードが有効なままデプロイすると、誰でも登録できてしまいセキュリティリスクになります。

## 🔍 初回ログイン時の動作フロー

### 通常のLINE認証フロー (SKIP_LINE_LOGIN = false)

1. ユーザーが `/local` にアクセス
2. LIFF SDK初期化
3. LINEログイン確認
4. LINE IDトークン取得
5. バックエンドで認証 (`/consumers/auth/verify`)
6. DBにユーザーが存在するか確認
   - **存在する**: 商品一覧画面を表示
   - **存在しない**: 会員登録フォームを表示
7. 会員登録フォーム入力
8. バックエンドで登録 (`/consumers/register`)
9. 商品一覧画面を表示

### 開発モード (SKIP_LINE_LOGIN = true)

1. ユーザーが `/local` にアクセス
2. **LIFF初期化をスキップ**
3. ダミーのlineUserIdとidTokenを設定
4. **会員登録フォームを直接表示**
5. フォーム入力
6. **ダミーデータで登録完了**
7. 商品一覧画面を表示

## 🐛 トラブルシューティング

### LINEログイン画面で止まる(本番環境)

**原因**: DBにユーザーのLINE IDが登録されていない

**解決方法**: 
- 開発モードを有効化して動作確認
- または、バックエンドで該当ユーザーを手動登録

### 商品が表示されない

**原因**: バックエンドAPIが起動していない、または商品データがない

**解決方法**:
- バックエンドサーバー(FastAPI)を起動
- 管理画面から商品を登録

### 登録フォームが表示されない

**原因**: 既に登録済みのユーザーとしてログインしている

**解決方法**:
- ブラウザのLocalStorageをクリア
- または、別のLINEアカウントでログイン

## 🎯 次のステップ

1. **商品データの準備**: 管理画面から商品を登録
2. **配送枠の設定**: 管理画面から配送スロットを設定
3. **注文フローの確認**: カート → 受取方法選択 → 注文確定の動作確認
4. **LINE LIFF設定**: 本番環境ではLIFF IDとエンドポイントURLを設定

## 📚 関連ファイル

- `/local` のエントリーポイント: `client/src/pages/local/LocalApp.tsx`
- 登録フォーム: `client/src/pages/local/ConsumerRegisterForm.tsx`
- 商品一覧: `client/src/pages/local/LocalHome.tsx`
- カート画面: `client/src/pages/local/LocalCart.tsx`
- プロフィール: `client/src/pages/local/LocalProfile.tsx`
- API設定: `client/src/services/api.ts`
- LIFF設定: `client/src/services/liff.ts`

---

**作成日**: 2026-01-17
**バージョン**: v1.0
