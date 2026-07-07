---
name: verify
description: WashokuMap の変更をローカルで実際に動かして確認する手順(DB起動 → dev サーバ → curl で API を叩く)
---

# WashokuMap の動作検証レシピ

## 前提・起動

- DB: `docker ps` で `washoku-db` が動いているか確認。無ければ `npm run db:up` → `npm run db:migrate`(状態確認は `npm run db:migrate:status`)。
- dev サーバはバックグラウンドで起動する。`.env.local` の `ADMIN_TOKEN` は読めない(秘匿)ので、
  **実環境変数で上書き**して既知のトークンにする(実環境変数が .env.local より優先される):

  ```powershell
  $env:ADMIN_TOKEN='verify-token-123'; $env:SITE_LOCK='false'; npm run dev
  ```

  検証対象に応じて `UPLOAD_STORAGE` / `SUPABASE_URL` 等も同様に上書きできる。
- 起動待ちは `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` をポーリング(初回コンパイルで数十秒)。

## API の叩き方(Bash ツールの curl を使う。PowerShell は日本語JSONが化ける)

- テスト画像の生成(sharp が node_modules にある):
  `node -e "require('sharp')({create:{width:800,height:600,channels:3,background:{r:200,g:30,b:30}}}).png().toFile('test.png')"`
- 管理アップロード: `curl -X POST http://localhost:3000/api/uploads -H 'x-admin-token: verify-token-123' -F 'file=@test.png;type=image/png'` → 201 `{url, thumbUrl}`
- 配信確認: 返ってきた `/api/uploads/<name>` を GET → 200 `image/webp`
- 孤立掃除: `curl -X POST http://localhost:3000/api/mayuchan/uploads/cleanup -H 'x-admin-token: verify-token-123' -H 'Content-Type: application/json' --data '{"dryRun":true,"olderThanHours":0}'`
- 管理APIは全部 `x-admin-token` ヘッダ。公開APIはレート制限あり(uploads は匿名20回/分)。

## 検証で作ったデータの後片付け

- アップロード画像は cleanup API(`dryRun:false, olderThanHours:0`)で消せる(未参照のみ)。
- 終了時: TaskStop で dev サーバ停止。DB はセッション開始時から動いていたなら残してよい。
- 仕上げに `npm run lint`(必要なら `npm run build`。dev サーバ停止後に実行)。
