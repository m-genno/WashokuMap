# データベース(スキーマ / マイグレーション)

[`docs/data-model.md`](../docs/data-model.md) の設計を SQL に落としたもの。
対象: **PostgreSQL 15+ / PostGIS**。psql / Supabase CLI どちらでも適用できる素のSQL。

## ディレクトリ

```
db/
├── migrations/        番号順に適用するスキーマ定義
│   ├── 0001_extensions.sql     拡張(postgis, citext)+共通トリガ関数
│   ├── 0002_users_auth.sql     app_user / auth_identity
│   ├── 0003_restaurants.sql    restaurant / genre / photo / hours / import_batch
│   ├── 0004_user_activity.sql  favorite / search_history
│   ├── 0005_reservations.sql   reservation / reservation_event
│   └── 0006_reviews.sql        review / review_report + 評価キャッシュ更新トリガ
└── seed/
    └── genres.sql     和食ジャンルの初期データ(upsert)
```

> マイグレーションは**番号順に依存**している(例: restaurant は app_user を参照)。必ず昇順で適用すること。

## 適用方法

### A. Docker Compose(ローカル開発・推奨)

リポジトリ直下の [`docker-compose.yml`](../docker-compose.yml) が PostGIS を起動し、
**初回起動時に `db/migrations/*` と `db/seed/genres.sql` を自動適用**する。

```bash
npm run db:up      # 起動(初回はスキーマ+seedを自動適用)
npm run db:logs    # ログ追跡
npm run db:down    # 停止(データは保持)
npm run db:reset   # データ削除して作り直し(スキーマ変更後はこれ)
```

接続先: `postgres://postgres:postgres@localhost:55432/washokumap`
(`.env.example` を `.env.local` にコピーして `DATABASE_URL` を利用)

> 自動適用は**データボリュームが空の初回起動時のみ**。マイグレーションを編集したら
> `npm run db:reset`(= `docker compose down -v && up`)で作り直す。

### B. psql(任意のマネージドPostgres / 手動適用)

```bash
# 例: ローカルの washokumap データベースへ
export DATABASE_URL="postgres://user:pass@localhost:5432/washokumap"

# マイグレーションを順に適用
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

# 初期データ投入
psql "$DATABASE_URL" -f db/seed/genres.sql
```

PowerShell の場合:

```powershell
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/washokumap"
Get-ChildItem db/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
psql $env:DATABASE_URL -f db/seed/genres.sql
```

### C. Supabase

Supabase は PostGIS を拡張として有効化できる。SQL Editor に各ファイルの内容を番号順に貼り付けて実行するか、Supabase CLI を使う場合は `supabase/migrations/` にタイムスタンプ付きでコピーして `supabase db push`。

> Supabase を使う場合は、別途 **Row Level Security (RLS)** ポリシーの追加を推奨(匿名ユーザの読み取り可・書き込み制限など)。本SQLにはRLSは含めていない。

## 設計上のポイント(抜粋)

- **評価キャッシュ**: `review` の変更時にトリガ `trg_review_rating` が `restaurant.rating_avg / rating_count` を再計算(published のみ集計)。
- **全文検索**: `restaurant.search_vector` を name / address / 多言語名 からトリガで自動生成(`'simple'` 設定で多言語対応)。ジャンル絞り込みは `restaurant_genre` の join。
- **地理検索**: `restaurant.location` は `geography(Point,4326)`、GiST 索引で `ST_DWithin` / `ST_Distance` を高速化。
- **updated_at**: `app_user / restaurant / reservation / review` は更新時に自動更新。
- **口コミ投稿資格**(予約実績の有無)は DB 制約ではなく**アプリ層で検証**する(設計判断)。

## まだ含めていないもの(将来)

- RLS ポリシー(Supabase 採用時)
- 多軸評価 `review_aspect`(料理/接客/雰囲気/コスパ)
- マイグレーション実行履歴の管理(本格運用時は Drizzle / Prisma / Supabase CLI などの導入を検討)
