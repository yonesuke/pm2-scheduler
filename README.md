# pm2-scheduler

PM2を使った定期実行タスク管理

## セットアップ

```bash
# PM2をグローバルインストール（未インストールの場合）
npm install -g pm2

# リポジトリをクローン
git clone <your-repo-url>
cd pm2-scheduler
```

## スケジュールされているジョブ

| ジョブ名 | 説明 | スケジュール |
|---------|------|-------------|
| n8n | ワークフロー自動化ツール | 常時起動 |
| radiko-recorder | radikoの番組を録音 | 毎時0分にチェック |
| podcast-server | 録音ファイルをポッドキャストとして配信 | 常時起動 (port 3456) |

## 必要なツール

- **PM2**: プロセス管理
- **uv**: Pythonスクリプト実行
- **ffmpeg**: radiko-recorderで使用

```bash
# macOS
brew install pm2 uv ffmpeg
```

## ジョブ別設定

### radiko-recorder

```bash
# .envファイルを作成
cp jobs/radiko-recorder/.env.example jobs/radiko-recorder/.env
# RADIKO_MAIL, RADIKO_PASSWORDを設定
```

### podcast-server

```bash
# ルートの.envファイルを作成
cp .env.example .env
# PODCAST_HOSTを外部公開URLに設定（例: https://example.com:3456）
```

## 使い方

### ジョブの追加

`ecosystem.config.js` にジョブを追加:

```javascript
{
  name: 'my-job',
  script: './scripts/my-script.js',
  cron_restart: '0 * * * *', // cron形式で実行タイミングを指定
  autorestart: false,
  watch: false,
}
```

### コマンド

```bash
npm start    # ジョブを開始
npm stop     # ジョブを停止
npm restart  # ジョブを再起動
npm run delete  # ジョブを削除
npm run logs    # ログを確認
npm run status  # ステータスを確認
```

## cron形式の例

- `0 * * * *` - 毎時0分
- `*/5 * * * *` - 5分ごと
- `0 0 * * *` - 毎日0時
- `0 9 * * 1-5` - 平日9時
