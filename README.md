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
