# WashokuMap 本番配備の検討(ホスティング選定)

> Status: Draft / 最終更新: 2026-06-23
> 関連: [`admin-guide.md`](./admin-guide.md) / [`cost-estimate.md`](./cost-estimate.md) / [`architecture.md`](./architecture.md)

このアプリ固有の事情から、本番ホスティングの選択は**主に2点**で決まります。
結論を先に書くと:

- **今のコードを最短で本番化するなら → 常駐Nodeコンテナ + 永続ディスク(Render / Railway / Fly.io)+ PostGIS対応マネージドPostgres**。
- **将来スケール・チーム運用するなら → 画像をオブジェクトストレージへ移す小改修をしてから Vercel(サーバレス)へ**。

---

## 1. 選定を左右するアプリ固有の制約

| # | 制約 | 影響 |
|---|---|---|
| 1 | **PostGIS が必須**(`geography` 型・`ST_DWithin` で近傍検索) | マネージドPostgresは **PostGIS対応が前提**。Vanilla Postgresだけの構成は不可。 |
| 2 | **画像をローカルFSに保存**(`node:fs` で `UPLOAD_DIR` に書込/配信) | **サーバレスの揮発FSと非互換**。永続ディスクを持つ常駐サーバで動かすか、S3/R2へ移行が必要。 |
| 3 | **sharp(ネイティブ)** + 全API `runtime = "nodejs"` | **Nodeランタイム必須**(Edge不可)。ネイティブバイナリを許容する環境が必要。 |
| 4 | **pg(node-postgres)で接続プール** | 常駐サーバなら素直。サーバレスは**接続プーラ(PgBouncer/Supavisor等)必須**。 |
| 5 | **マイグレーションは手動(0001〜0012)** | docker init マウントはローカル専用。本番は**デプロイ時にマイグレーション実行手順**が必要。 |
| 6 | Next.js 16 App Router / Node 20 | Next対応ホスト。`engines` 未固定なので Node 20+ を固定推奨。 |

> 要するに **②画像のローカルFS依存** が分岐点。これがある限りサーバレス(Vercel)はそのままでは動かず、永続ディスク付きの常駐サーバが最短。

---

## 2. 2つの構成

### 構成A: 常駐Nodeコンテナ + 永続ディスク(現状コードのまま)
```
[ Render / Railway / Fly.io ]  Web(Node常駐) + Persistent Disk(/uploads)
            │
            ├── Managed Postgres + PostGIS   (Supabase / Render / Neon)
            ├── Resend(メール) / OSM(地図) / DeepL(任意)
            └── 独自ドメイン + HTTPS
```
- **長所**: コード変更ほぼ不要。`UPLOAD_DIR` を永続ボリュームにマウントするだけ。pgプールが素直に効く。sharp/FSがそのまま動く。
- **短所**: 永続ディスクは基本1ノード前提。水平スケール(多ノード)時は②をS3化する必要。

### 構成B: サーバレス(Vercel)+ マネージドDB + オブジェクトストレージ
```
[ Vercel ]  Next.js(関数/エッジ)
     │
     ├── Postgres + PostGIS（pooled接続） (Supabase / Neon)
     ├── Object Storage（S3 / Cloudflare R2 / Supabase Storage）← uploads移行が前提
     └── Resend / 有料地図 / 独自ドメイン
```
- **前提改修**: `src/lib/uploads.ts` の `saveImage`/`readImage` をストレージSDKに置換し、配信を署名URL or CDN経由に。DB接続は**プーラ用URL**へ。
- **長所**: スケール・DX・グローバル配信が最良。Next.jsとの相性が一番良い。
- **短所**: 今すぐは動かない(FS依存の改修必須)。

---

## 3. 推奨スタック

### 3.1 まず本番化(小規模・最短)= 構成A
| 役割 | 推奨 | 補足 |
|---|---|---|
| アプリ実行 | **Render**(Web Service + Persistent Disk)/ Railway / Fly.io | Dockerfile か Nodeビルドで配備。`/uploads` を永続ディスクに。 |
| データベース | **Supabase**(Postgres+PostGIS、自動バックアップ)/ Render Postgres / Neon | PostGISが**ターンキー**で有効化でき、将来 Supabase Storage で②の移行先にもなる。 |
| メール | **Resend**(送信ドメインのDNS検証) | `RESEND_API_KEY` / `NOTIFICATION_FROM_EMAIL` |
| 地図/ジオコーディング | 当面 **OSM + Nominatim**(無料) | 商用・高トラフィック化で有料へ(§cost-estimate §2.2) |
| ドメイン/DNS | 任意レジストラ | `APP_BASE_URL` に反映 |
| コード/CI | GitHub | デプロイ連携 |

- **月額目安**: アプリ $7〜25 + DB $0〜25(無料枠開始可)+ メール $0〜20。合計 **おおむね $10〜60/月** + ドメイン。

### 3.2 スケール期 = 構成B(uploads改修後)
- **Vercel + Neon or Supabase(pooled)+ Cloudflare R2(画像)**。Next.jsの強みを最大化。
- 移行の鍵は「画像をオブジェクトストレージへ」だけ。DB(PostGIS)はそのまま使える。

> どちらの構成でも DB を **Supabase に置いておくと、A→B の移行が滑らか**(PostGISそのまま、Storageが画像移行先になる)。

---

## 4. このアプリのデプロイ前チェックリスト

- [ ] **`ADMIN_TOKEN` を必ず設定**(未設定だと管理APIが開放される)。
- [ ] **PostGIS を有効化**(`create extension postgis;` / `0001_extensions.sql`)。
- [ ] **マイグレーションを本番DBへ適用**: `DATABASE_URL`(必要なら `DATABASE_SSL=true`)を本番に向けて `node scripts/migrate.mjs`(= `npm run db:migrate`)。冪等で未適用分だけ走るので**デプロイのたびに実行**してよい。CI/デプロイ手順に組み込む(docker init マウントは本番では使わない)。詳細は [`db/README.md`](../db/README.md)。
- [ ] **`UPLOAD_DIR` を永続化**(構成A: 永続ディスク / 構成B: S3・R2へ移行)。
- [ ] 環境変数: `DATABASE_URL`(サーバレスはプーラ用)、`RESEND_API_KEY` / `NOTIFICATION_FROM_EMAIL`(+ 任意 `RESERVATION_DESK_EMAIL`)、`APP_BASE_URL`、任意 `DEEPL_API_KEY` / `GEOCODE_API_URL`。
- [ ] **送信ドメインの SPF/DKIM 検証**(到達率)。
- [ ] **Node 20+ を固定**(`engines` に明記)。コンテナ最小化に `next.config` の `output: "standalone"` を検討。
- [ ] HTTPS / 独自ドメイン、**DBの自動バックアップ**、(任意)エラー監視(Sentry等)。
- [ ] 地図: 商用・高トラフィック化したらキー付きプロバイダへ切替(`GEOCODE_API_URL` とタイル設定 `src/components/RestaurantMap.tsx`)。

---

## 5. まとめ(意思決定)

- **今すぐ・最小工数で本番に出す**: **Render(または Railway/Fly)+ Supabase Postgres(PostGIS)**。永続ディスクに `/uploads` を載せれば現状コードのまま動く。
- **将来スケール・チーム化**: 画像をオブジェクトストレージへ移す小改修 → **Vercel + pooled Postgres + R2**。
- **Vercel を最初から使いたい場合の唯一の必須作業**は「**画像のローカルFS依存を解消(S3/R2化)**」。これだけ片付けばサーバレス構成に乗る。
