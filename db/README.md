# データベース(スキーマ / マイグレーション)

[`docs/data-model.md`](../docs/data-model.md) の設計を SQL に落としたもの。
対象: **PostgreSQL 15+ / PostGIS**。psql / Supabase CLI どちらでも適用できる素のSQL。

スキーマの適用は **マイグレーションランナー(`scripts/migrate.mjs`)** で行う。
`db/migrations/*.sql` を番号順に、未適用のものだけ適用し `schema_migrations` 表に記録する(冪等)。
**ローカルも本番も同じ手順**(本番では docker の自動適用は使わない)。

## ディレクトリ

```
db/
├── migrations/        番号順に適用するスキーマ + 必須参照データ
│   ├── 0001_extensions.sql          拡張(postgis, citext)+共通トリガ関数
│   ├── 0002_users_auth.sql          app_user / auth_identity
│   ├── 0003_restaurants.sql         restaurant / genre / photo / hours / import_batch
│   ├── 0004_user_activity.sql       favorite / search_history
│   ├── 0005_reservations.sql        reservation / reservation_event
│   ├── 0006_reviews.sql             review / review_report + 評価キャッシュ更新トリガ
│   ├── 0007_search_trgm.sql         CJK部分一致(pg_trgm)+ search_text
│   ├── 0008_event_channel_web.sql   予約イベントの channel に 'web' を許可
│   ├── 0009_admin_audit.sql         admin_audit_log(管理操作の監査)
│   ├── 0010_review_photo.sql        review_photo(口コミ写真)
│   ├── 0011_review_photo_thumb.sql  review_photo.thumb_url
│   ├── 0012_restaurant_photo_thumb.sql  restaurant_photo.thumb_url
│   └── 0013_genres.sql              和食ジャンルの参照データ(upsert・必須)
└── seed/              動作確認用のテストデータ(任意・本番では使わない)
    ├── sample_restaurants.sql   サンプル5店舗
    ├── bulk_restaurants.sql     約200店舗(決定的ID + upsert)
    └── bulk_activity.sql        ユーザ/口コミ/予約/通報/営業時間
```

> マイグレーションは**番号順に依存**している(例: restaurant は app_user を参照、0013 は 0003 の genre 表に依存)。ランナーが昇順に適用する。

## 適用方法

接続先は **`DATABASE_URL`**(未設定時は `.env.local` → ローカル既定 `…@localhost:55432/washokumap` の順で解決)。

### A. ローカル開発(推奨)

```bash
npm run db:up              # 空の PostGIS を起動
npm run db:migrate         # 0001.. を適用(冪等。DB起動を待ってから実行される)
npm run db:seed            # 任意: 動作確認用データを投入
# まとめて作り直し:
npm run db:fresh           # = db:reset → db:migrate → db:seed
# 状態確認:
npm run db:migrate:status  # 適用済み / 未適用の一覧
```

### B. 本番 / 任意のマネージドPostgres

`DATABASE_URL` を本番のものに向けてランナーを実行するだけ。SSL が必要な場合は
`DATABASE_SSL=true`(または URL に `sslmode=require`)。

```bash
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
export DATABASE_SSL=true          # マネージドDBで必要なら
node scripts/migrate.mjs          # 未適用のマイグレーションを適用
node scripts/migrate.mjs --status # 確認のみ
```

> 冪等なので、デプロイのたびに実行してよい(未適用分だけ走る)。CI/デプロイ手順に組み込む。
> `schema_migrations(version, applied_at)` 表で適用履歴を管理する。

### C. psql で手動適用(ランナーを使わない場合)

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

ただし 0002〜0006 は `create table`(IF NOT EXISTS なし)で**再実行不可**。手動適用は初回のみ、
以降の差分適用には**ランナーの利用を推奨**(適用済みを自動でスキップするため)。

### D. Supabase

PostGIS を拡張として有効化できる。`DATABASE_URL`(またはプーラ用URL)を指定してランナーを実行するのが簡単。
Supabase CLI を使う場合は `supabase/migrations/` にコピーして `supabase db push` でも可。

> Supabase 採用時は **Row Level Security (RLS)** の追加を推奨(匿名読み取り可・書き込み制限など)。本SQLにRLSは含めていない。

## 設計上のポイント(抜粋)

- **評価キャッシュ**: `review` の変更時にトリガが `restaurant.rating_avg / rating_count` を再計算(published のみ集計)。
- **全文検索**: `restaurant.search_vector` / `search_text` を name / address / 多言語名 / 紹介文 からトリガで自動生成。CJKの部分一致は `search_text` ILIKE(pg_trgm)で補完。
- **地理検索**: `restaurant.location` は `geography(Point,4326)`、GiST 索引で `ST_DWithin` / `ST_Distance` を高速化。
- **updated_at**: `app_user / restaurant / reservation / review` は更新時に自動更新。
- **口コミ投稿資格**(予約実績の有無)は DB 制約ではなく**アプリ層で検証**する(設計判断)。

## まだ含めていないもの(将来)

- RLS ポリシー(Supabase 採用時)
- 多軸評価 `review_aspect`(料理/接客/雰囲気/コスパ)
- ロールバック(down)マイグレーション。現状は前進(up)のみ。
