# AITuberKit ライブ配信ID自動取得機能の修正依頼

## プロジェクト概要

**AITuberKit**は、YouTubeライブ配信のコメントを取得し、AIキャラクター（Live2D）がリアルタイムで応答するシステムです。Next.js + TypeScriptで構築されており、YouTube Data API v3を使用してコメントを取得します。

## 現在の実装状況

### 起動フロー

1. **`start.bat`**を実行すると、以下の処理が実行されます：
   - `scripts/get-live-stream-id.js`を実行してライブ配信IDを自動取得
   - 取得したIDを`.env`ファイルの`NEXT_PUBLIC_YOUTUBE_LIVE_ID`に書き込み
   - Next.jsサーバーを起動
   - ChromeでYouTubeのライブ配信ページを開く

### ライブ配信ID取得スクリプト（`scripts/get-live-stream-id.js`）

#### 認証方法

2つの認証方法をサポート：

1. **OAuth認証（推奨）**
   - `.env`に以下を設定：
     - `CLIENT_ID`
     - `CLIENT_SECRET`
     - `REFRESH_TOKEN`
   - チャンネルIDは不要（自動取得）

2. **API Key + チャンネルID**
   - `.env`に以下を設定：
     - `NEXT_PUBLIC_YOUTUBE_API_KEY`（必須）
     - `NEXT_PUBLIC_YOUTUBE_CHANNEL_ID`（必須）

#### 現在の取得ロジック

現在のスクリプトは以下の優先順位でライブ配信IDを取得しようとしています：

1. **配信中（`eventType: 'live'`）**: YouTube APIの`search`エンドポイントで`eventType: 'live'`を検索
2. **予約中（`eventType: 'upcoming'`）**: `eventType: 'upcoming'`で検索し、最新のものを取得
3. **最新アーカイブ**: `liveBroadcastContent: 'none'`の動画を取得

#### 現在の問題点

- **問題**: 現在配信中の「C_l-WUHyLpA」が取得されず、古い配信「cobPhiFeFZc」が取得されてしまう
- **原因の可能性**:
  1. `.env`の`NEXT_PUBLIC_YOUTUBE_UPCOMING_STREAM_ID=cobPhiFeFZc`が何らかの形で優先されている
  2. `eventType: 'live'`の検索結果が正しく処理されていない
  3. 複数のライブ配信がある場合の優先順位が正しく機能していない

## 期待する動作

### 優先順位（厳密に守る必要がある）

1. **最優先: 配信中のライブ配信ID**
   - `eventType: 'live'`で検索
   - 複数の配信がある場合、**最新の配信**（`publishedAt`が最新）を取得
   - 配信IDの形式: 11文字の英数字（例: `C_l-WUHyLpA`）

2. **第2優先: 予約中のライブ配信ID（最新）**
   - 配信中が見つからない場合のみ
   - `eventType: 'upcoming'`で検索
   - 複数の予約配信がある場合、**最新の予約配信**（`publishedAt`が最新）を取得

3. **第3優先: 最新のアーカイブ配信ID**
   - 配信中も予約中も見つからない場合のみ
   - `order: 'date'`で検索
   - `liveBroadcastContent: 'none'`の動画を取得

### 出力形式

スクリプトは標準出力（stdout）にJSON形式で結果を出力します：

```json
{
  "liveStreamId": "C_l-WUHyLpA",
  "isLive": true,
  "latestVideoId": "",
  "channelId": "UCxxxxxxxxxxxxx"
}
```

- `liveStreamId`: 配信中または予約中のライブ配信ID（空文字列の場合は配信なし）
- `isLive`: `true` = 配信中、`false` = 予約中またはアーカイブ
- `latestVideoId`: 最新の動画ID（`liveStreamId`が空の場合のみ）
- `channelId`: チャンネルID

## 技術的な詳細

### YouTube Data API v3 の使用

#### 使用エンドポイント

1. **`search`エンドポイント**
   - クォータ使用量: 100クォータ/リクエスト（`maxResults`の数は関係ない）
   - パラメータ:
     - `part: 'id,snippet'`
     - `channelId`: チャンネルID
     - `type: 'video'`
     - `eventType: 'live'` または `'upcoming'`
     - `maxResults`: 1-50（推奨: 10程度で十分）

2. **`videos`エンドポイント**
   - クォータ使用量: 1クォータ/動画
   - パラメータ:
     - `part: 'id,snippet,liveStreamingDetails'`
     - `id`: 動画ID（カンマ区切りで最大50件）

3. **`channels`エンドポイント**（OAuth認証時のみ）
   - クォータ使用量: 1クォータ/リクエスト
   - パラメータ:
     - `part: 'id'`
     - `mine: 'true'`

### 動画IDの検証

- 形式: 11文字の英数字、ハイフン、アンダースコア
- 正規表現: `/^[a-zA-Z0-9_-]+$/`
- 例: `C_l-WUHyLpA`（有効）、`cobPhiFeFZc`（有効）

### エラーハンドリング

- すべてのエラーメッセージは`stderr`に出力
- JSON結果のみ`stdout`に出力（`start.bat`がパースするため）
- APIエラーは適切にキャッチして処理

## 関連ファイル

### 主要ファイル

1. **`scripts/get-live-stream-id.js`**
   - ライブ配信ID取得のメインスクリプト
   - Node.jsで実装（標準ライブラリのみ使用）

2. **`start.bat`**
   - 起動スクリプト（Windows）
   - `get-live-stream-id.js`を実行
   - 結果をパースして`.env`を更新
   - Next.jsサーバーを起動

3. **`scripts/parse-json-result.js`**
   - JSON結果をパースして`start.bat`が読みやすい形式に変換

4. **`.env`**
   - 環境変数ファイル
   - `NEXT_PUBLIC_YOUTUBE_LIVE_ID`: 取得したライブ配信IDが書き込まれる
   - `NEXT_PUBLIC_YOUTUBE_UPCOMING_STREAM_ID`: 現在は使用しない（削除または無視）

### コードの構造

```javascript
// メイン関数
async function main() {
  // 1. .envファイルを読み込む
  // 2. 認証方法を決定（OAuth優先）
  // 3. ライブ配信IDを取得
  // 4. JSON形式で出力
}

// OAuth認証版
async function getLiveStreamIdWithOAuth(apiKey, clientId, clientSecret, refreshToken, preferredLiveId)

// API Key認証版
async function getLiveStreamIdWithApiKey(apiKey, channelId, preferredLiveId)
```

## 修正が必要な点

### 1. `.env`の`NEXT_PUBLIC_YOUTUBE_UPCOMING_STREAM_ID`の無視

現在、この値が設定されていると優先的に使用される可能性があります。**この値は完全に無視**し、常にAPIから最新の状態を取得する必要があります。

### 2. 配信中ライブ配信の確実な取得

`eventType: 'live'`で検索した結果が正しく処理されているか確認してください。特に：
- 複数の配信がある場合、最新のものを取得できているか
- 配信IDの検証が正しく行われているか
- エラーが発生した場合のフォールバック処理

### 3. 優先順位の厳密な実装

以下の順序を厳密に守る必要があります：
1. 配信中 → 見つかれば即座に返す
2. 配信中が見つからない場合のみ予約中を検索
3. 予約中も見つからない場合のみアーカイブを検索

### 4. デバッグ情報の充実

`stderr`に詳細なログを出力して、どの段階で問題が発生しているか確認できるようにしてください。

## テストケース

### ケース1: 配信中
- 入力: チャンネルに「C_l-WUHyLpA」が配信中
- 期待: `{"liveStreamId": "C_l-WUHyLpA", "isLive": true, ...}`

### ケース2: 複数の配信
- 入力: 複数のライブ配信が同時に存在
- 期待: 最新の配信（`publishedAt`が最新）を取得

### ケース3: 予約配信のみ
- 入力: 配信中はなく、予約配信のみ存在
- 期待: 最新の予約配信IDを取得、`isLive: false`

### ケース4: アーカイブのみ
- 入力: 配信中も予約中もない
- 期待: 最新のアーカイブ動画IDを取得、`liveStreamId: ""`

## 注意事項

1. **APIクォータの節約**: 不要なAPIリクエストは避ける
2. **エラーハンドリング**: ネットワークエラーやAPIエラーに適切に対応
3. **パフォーマンス**: 可能な限り少ないAPIリクエストで目的を達成
4. **互換性**: 既存の`start.bat`との互換性を保つ（出力形式を変更しない）

## 質問・確認事項

もし不明な点があれば、以下を確認してください：

1. `.env`ファイルの構造
2. `start.bat`のパース処理の詳細
3. 現在のエラーメッセージやログの内容
4. YouTube APIのレスポンス形式

以上です。よろしくお願いします。

