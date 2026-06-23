@AGENTS.md

# WashokuMap — プロジェクトメモ(作業効率化用)

和食店に特化したインバウンド向けWebアプリ。アプリ未インストール/登録不要(匿名 localStorage)、
店名・ジャンルで検索 → 地図+一覧 → 詳細・予約・口コミ。詳細設計は `docs/` 参照。

## 技術スタック(前提として把握しておくこと)
- Next.js 16(App Router / Turbopack)・React 19・TypeScript・Tailwind v4
- PostgreSQL 16 + **PostGIS**。ORM不使用、**生SQL(`pg` / node-postgres)**。`src/lib/db.ts` の `pool` / `query`
- 地図: Leaflet + react-leaflet v5(`dynamic(..., { ssr:false })`)。タイルは OpenStreetMap
- 画像: **sharp**(アップロード時に WebP 圧縮+サムネ生成)。保存は**ローカルFS**(`UPLOAD_DIR`)
- 認証なし。管理は `x-admin-token`(`ADMIN_TOKEN`)、利用者は匿名 localStorage UUID(`wm.anonId`)
- 翻訳=DeepL / メール=Resend / ジオコーディング=Nominatim(すべて任意・未設定はフォールバック)

## ディレクトリ地図(探索前に読む)
- `src/app/` … ページ + APIルート(App Router)
  - `api/admin/*` … 管理API(`isAdminAuthorized` でトークン保護)
  - `api/restaurants` `api/reservations` `api/reviews` `api/uploads` … 公開/共通API
  - `admin/*` … 管理画面 / `restaurants/[id]` `search` `favorites` `offline` `reservations/[id]` … 公開画面
- `src/lib/` … サーバ処理: `restaurants` `reservations` `reviews` `adminRestaurants` `adminAudit`
  `uploads` `i18n` `translation` `geocode` `notifications` `guestNotifications` `users` `serverLocale` `db`
  / クライアント: `clientStore`(匿名ID・お気に入り)・`adminClient`(トークン)
- `src/components/` … `Admin*`(管理UI)/ `Restaurant*` `Review*` `Reservation*`(公開UI)
- `db/migrations/` … 番号順SQL(`scripts/migrate.mjs` が適用)/ `db/seed/` … テストデータ
- `docs/` … `architecture` `data-model` `cost-estimate` `admin-guide`(運用手順)`deployment`(本番配備)
- `scripts/migrate.mjs` … マイグレーションランナー

## 規約・つまずきポイント
- Next 16: `cookies()`(next/headers)は **async**。cookie を読むページは動的(`ƒ`)になる。
- DB/FS/sharp を使うAPIルートは `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"`。
- SQLは必ずパラメータ化(`$1`…)。ILIKE は `escapeLike` + `ESCAPE '\\'`。
- i18n: `src/lib/i18n.ts` に **5言語辞書**(ja/en/zh-Hans/zh-Hant/ko)。`translator(locale)` でUI文言、
  `pickTranslation(jsonb, locale, fallback)` でデータ訳。
- 写真の型は **`{ url, thumbUrl }`**(全経路で統一)。`isUploadUrl` で自前アップロードURLのみ許可。
- ESLint: 効果(effect)本体で直接 setState すると `react-hooks/set-state-in-effect` で落ちる。
  → effect内の名前付き関数に包む / `reloadKey` パターンを使う。

## ソース/DBを直したら連動して直すもの(重要)
- **新規マイグレーション**: `db/migrations/00NN_*.sql` を追加(次番号、可能なら冪等SQL)。
  適用は **`npm run db:migrate`**(本番は `DATABASE_URL` を向けて `node scripts/migrate.mjs`、要なら `DATABASE_SSL=true`)。
  docker の自動適用は廃止。→ あわせて `db/README.md` のマイグレーション一覧を更新。
- **テーブル列の追加/変更(読み取りで使う)**: その lib の行 interface + SELECT、**消費する component の props 型**、
  **API のバリデーション/レスポンス**を同時に直す(例: 写真 `{url,thumbUrl}` は多ファイルに波及)。
- **UI文言の追加**: `src/lib/i18n.ts` の **5言語すべて**にキーを追加(en→ja→key フォールバック)。
- **管理の更新系アクション追加**: `isAdminAuthorized` で保護 → `recordAdminAudit(adminActor(req))` で監査記録 →
  `src/components/AdminAuditList.tsx` の action ラベル/バッジを追加。
- **予約ステータスの遷移変更**: `src/lib/reservations.ts` の `ALLOWED_TRANSITIONS` と
  `src/components/AdminReservationList.tsx` の `ACTIONS` を**両方**そろえる。
- **環境変数の追加**: `.env.example` / `docs/admin-guide.md` §9(外部アカウントなら §11)/ `docs/deployment.md` チェックリスト。
- **外部サービスの追加**: `docs/admin-guide.md` §11 の表 + `docs/cost-estimate.md`。
- **ジャンルコードの追加**: `db/migrations/0013_genres.sql`(参照データ)。

## ローカル起動 / 検証(既知の正常手順)
- DB: `npm run db:up`(空)→ `npm run db:migrate` → `npm run db:seed`。一括は **`npm run db:fresh`**。
  接続: `postgres://postgres:postgres@localhost:55432/washokumap`。状態確認 `npm run db:migrate:status`。
- アプリ: `npm run dev`(:3000)。検証後は `npm run lint`(必要なら `npm run build`)。
- 既存DBに新マイグレーションだけ当てる: `npm run db:migrate`(適用済みは自動スキップ)。

## 環境特有の注意(Windows / PowerShell — 無駄足を避ける)
- PowerShell の `Invoke-RestMethod` やコンソールは**日本語JSONを文字化け**しやすい。
  UTF-8の往復は **Bashツールの `curl`(`--data-binary @file`)** を使い、結果はファイル経由で読む。
- PowerShellから `psql -f` を**stdinパイプ**すると複数行SQLが壊れる。
  → `docker cp file washoku-db:/tmp/x.sql && docker exec ... psql -f /tmp/x.sql`。
- コミットメッセージ: PowerShell の here-string は引用符/括弧で壊れる。**ファイルに書いて `git commit -F file`**。
- `dev.log` と `/uploads` はコミットしない(gitignore済)。検証後は node 停止 + `docker compose down`。
