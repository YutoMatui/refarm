# 消費者用LIFF設定ガイド

## 📱 LINE Developers Consoleでの設定

### 1. LIFF設定情報

**LIFF ID**: `2008876692-njfa3HgM`

### 2. LINE Developers Consoleでの設定手順

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 該当のLINE公式アカウントを選択
3. 「LIFF」タブを開く
4. LIFF ID `2008876692-njfa3HgM` を選択して編集

### 3. LIFF エンドポイント URL設定

```
https://refarm-nine.vercel.app/local
```

**重要**: `/local` パスを必ず含めてください

### 4. LIFF設定項目

- **サイズ**: `Full` (全画面)
- **エンドポイントURL**: `https://refarm-nine.vercel.app/local`
- **スコープ**: 
  - ✅ `profile` (必須)
  - ✅ `openid` (必須)
  - ✅ `email` (オプション、将来的な拡張用)

### 5. その他の設定

- **モジュールモード**: OFF (デフォルト)
- **スキャンQRコード**: OFF (必要に応じて有効化)
- **Bluetooth®**: OFF (必要に応じて有効化)

## 🔧 環境変数設定

### Vercelでの設定

Vercelのプロジェクト設定で以下の環境変数を追加してください:

```env
VITE_CONSUMER_LIFF_ID=2008876692-njfa3HgM
```

**設定手順**:
1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. プロジェクト「refarm」を選択
3. 「Settings」→「Environment Variables」を開く
4. 新しい環境変数を追加:
   - **Name**: `VITE_CONSUMER_LIFF_ID`
   - **Value**: `2008876692-njfa3HgM`
   - **Environment**: Production, Preview, Development (全て選択)
5. 「Save」をクリック
6. 再デプロイ (Deployments タブから最新のデプロイを Redeploy)

## 🧪 動作確認

### 1. LINE公式アカウントでテスト

1. LINE公式アカウントのリッチメニューまたはメッセージから、消費者用LIFFアプリを開くリンクを設定
2. LINEアプリでリンクをタップ
3. 以下の画面が表示されれば成功:
   - 初回: 会員登録フォーム
   - 2回目以降: 商品一覧画面

### 2. URLスキーム

LINEで以下のURLをメッセージとして送信すると、LIFFアプリが開きます:

```
https://liff.line.me/2008876692-njfa3HgM
```

### 3. トラブルシューティング

#### エラー: "LIFFの初期化に失敗しました"

- LINE Developers ConsoleでLIFF IDが正しく設定されているか確認
- エンドポイントURLに `/local` が含まれているか確認
- Vercelの環境変数が正しく設定されているか確認

#### エラー: "認証に失敗しました"

- LINEでログインしているか確認
- スコープに `profile` と `openid` が含まれているか確認
- バックエンドAPIが正常に動作しているか確認

## 📊 LIFF IDの役割分担

本プロジェクトでは3つのLIFF IDを使用しています:

| LIFF ID | 対象ユーザー | エンドポイント | 用途 |
|---------|------------|--------------|------|
| `2008674356-P5YFllFd` | 飲食店 | `/` | B2B飲食店向け発注システム |
| `2008689915-hECRflxu` | 生産者 | `/producer` | 生産者向け在庫・受注管理 |
| `2008876692-njfa3HgM` | 消費者 | `/local` | B2C一般消費者向けEC |

## 🚀 デプロイ後の確認事項

1. ✅ Vercelで環境変数が設定されている
2. ✅ LINE Developers ConsoleでエンドポイントURLが設定されている
3. ✅ LINEアプリからLIFFアプリが開ける
4. ✅ 会員登録フォームが表示される
5. ✅ 商品一覧が表示される

## 📝 メモ

- フロントエンドのデプロイ先: Vercel (`https://refarm-nine.vercel.app`)
- バックエンドのデプロイ先: Railway (`https://refarm-production.up.railway.app`)
- 消費者用LIFFは `/local` パスで動作
- 自動的に消費者用LIFF IDが選択される仕組みになっています

