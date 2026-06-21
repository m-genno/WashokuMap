# WashokuMap

和食店に特化した **インバウンド向け Web アプリ**。食べログ・一休などに未掲載の和食店を、**インストール不要・登録不要**で検索・予約できることを目指す。

- インストール不要(PWA / Webアプリ)
- 登録不要(匿名で利用、希望者だけ Google/Apple ログインで同期)
- 言葉の壁を越える予約(自動翻訳＋原文併記)
- 口コミ・評価(予約実績のあるユーザのみ投稿可)

## ドキュメント

設計の詳細は [`docs/`](./docs/) を参照。

- [`docs/architecture.md`](./docs/architecture.md) — アーキテクチャ設計書
- [`docs/data-model.md`](./docs/data-model.md) — データモデル設計
- [`docs/cost-estimate.md`](./docs/cost-estimate.md) — コスト見積もり

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript
- Tailwind CSS v4
- PWA(Web App Manifest + Service Worker)

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
npm run start    # 本番サーバ起動
npm run lint
```

### ローカルDB(PostgreSQL + PostGIS)

Docker Compose で起動し、初回のみ [`db/`](./db/) のマイグレーション+seedを自動適用する。

```bash
cp .env.example .env.local   # DATABASE_URL を用意
npm run db:up                # DB起動(初回はスキーマ+seedを自動適用)
npm run db:down              # 停止(データ保持)
npm run db:reset             # スキーマ変更後に作り直し
```

接続先: `postgres://postgres:postgres@localhost:55432/washokumap` / 詳細は [`db/README.md`](./db/README.md)。

> Service Worker は本番環境(`npm run build` + `npm run start`)でのみ登録されます。
> 開発時(`npm run dev`)はキャッシュの混乱を避けるため無効です。

## 現状(雛形)

トップページ・PWA基盤・オフラインページのみ実装済み。検索 / 地図 / 店舗詳細 / 予約 / 口コミは後続フェーズで実装予定([`docs/architecture.md`](./docs/architecture.md) の開発ロードマップ参照)。
