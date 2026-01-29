# CLAUDE.md

## Git操作

```bash
# 変更をコミット
git add -A
git commit -m "メッセージ"

# プッシュ
git push

# 別の環境でクローン
git clone https://github.com/yonesuke/pm2-scheduler.git

# 最新を取得
git pull
```

## PM2コマンド

```bash
npm start       # ジョブ開始
npm stop        # ジョブ停止
npm restart     # ジョブ再起動
npm run delete  # ジョブ削除
npm run logs    # ログ確認
npm run status  # ステータス確認
```

## ジョブの追加

`ecosystem.config.js` に追加:

```javascript
{
  name: 'job-name',
  script: './scripts/your-script.js',
  cron_restart: '0 * * * *',  // cron形式
  autorestart: false,
}
```
