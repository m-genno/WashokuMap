# 開発コマンド一覧(チートシート)

WashokuMap の開発でよく使うコマンドを、**何をするか / いつ使うか**つきでまとめます。
初めての人はまず「[1. 初回セットアップ](#1-初回セットアップ初めての人はこれ)」を上から順に実行してください。

- 前提ツール: **Node.js 20+**、**Docker Desktop**(ローカルDB用)、Git
- 関連: [`db/README.md`](../db/README.md)(DB詳細)/ [`admin-guide.md`](./admin-guide.md)(運用)/ [`deployment.md`](./deployment.md)(本番配備)
- 注: npm スクリプトは Windows / macOS / Linux 共通で動きます。DBコンテナ名は `washoku-db`、接続は `postgres://postgres:postgres@localhost:55432/washokumap`。

---

## 1. 初回セットアップ(初めての人はこれ)

```bash
# 1) 依存パッケージを入れる
npm install

# 2) 環境変数ファイルを用意(雛形をコピーして編集)
cp .env.example .env.local          # Windows PowerShell: Copy-Item .env.example .env.local

# 3) ローカルDBを起動 → スキーマ適用 → 動作確認用データ投入
npm run db:up                       # 空の PostgreSQL+PostGIS を起動
npm run db:migrate                  # スキーマ(0001..)を適用
npm run db:seed                     # 約200店舗+口コミ/予約などのテストデータ(任意)

# 4) アプリを起動
npm run dev                         # http://localhost:3000
```

> 2〜3 はまとめて `npm run db:fresh` でも可(下記)。

---

## 2. 毎日の開発(よく使う)

| やりたいこと | コマンド | 説明 |
|---|---|---|
| アプリを起動して開発 | `npm run dev` | http://localhost:3000。保存で自動リロード(ホットリロード)。 |
| DBを起動 | `npm run db:up` | 開発前にDBコンテナを立ち上げる。起動済みなら何もしない。 |
| DBを止める | `npm run db:down` | コンテナ停止。**データは残る**(次回 `db:up` で復帰)。 |
| コードの体裁チェック | `npm run lint` | ESLint。コミット前に通しておく。 |
| 本番ビルドの確認 | `npm run build` | 型エラー・ビルドエラーを検出。PWA含め確認するなら次項。 |

> 開発の基本ループ: `npm run db:up`(初回のみ)→ `npm run dev` → コードを編集 → 保存で反映。

---

## 3. シナリオ別の流れ

### A. 最新コードを pull した後(新しいマイグレーションがあるかも)
```bash
npm install            # 依存が増えていることがある
npm run db:up          # DBが止まっていたら起動
npm run db:migrate     # 未適用のマイグレーションだけ適用(冪等。なければ何もしない)
npm run dev
```

### B. DBを作り直したい(スキーマやシードをまっさらに)
```bash
npm run db:fresh       # = DBデータ削除 → 再起動 → migrate → seed を一括実行
```
> `db:fresh` は **データを完全に消して**作り直します。テストで汚れたDBをリセットしたいとき向け。

### C. PWA(オフライン動作)込みで確認したい
```bash
npm run build
npm run start          # 本番モードで http://localhost:3000(Service Worker が有効)
```
> `npm run dev` では Service Worker のキャッシュ挙動が本番と異なるため、PWA確認は build+start で。

### D. 本番DBへマイグレーションを適用する
```bash
# DATABASE_URL を本番に向けて実行(冪等なのでデプロイのたびに走らせてOK)
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
export DATABASE_SSL=true            # マネージドDBでSSLが必要な場合
node scripts/migrate.mjs            # = npm run db:migrate
node scripts/migrate.mjs --status   # 適用状況の確認のみ
```
> 詳細は [`db/README.md`](../db/README.md) / [`deployment.md`](./deployment.md)。

---

## 4. コマンド一覧(全件)

### アプリ
| コマンド | 何をする | いつ使う |
|---|---|---|
| `npm run dev` | 開発サーバ起動(ホットリロード) | 普段の開発 |
| `npm run build` | 本番ビルド(型/ビルド検査も兼ねる) | コミット前の確認・デプロイ前 |
| `npm run start` | ビルド済みを本番モードで起動 | PWA/本番挙動の確認 |
| `npm run lint` | ESLint で静的チェック | コミット前 |

### データベース(Docker)
| コマンド | 何をする | 注意 |
|---|---|---|
| `npm run db:up` | DBコンテナを起動(空のDB) | 初回はスキーマ未適用。続けて `db:migrate` |
| `npm run db:down` | DBコンテナを停止 | データは保持される |
| `npm run db:reset` | データ削除して再起動 | **データが消える**(`down -v` 相当) |
| `npm run db:logs` | DBのログを追跡表示 | 接続エラー調査など。Ctrl+C で終了 |
| `npm run db:fresh` | reset → migrate → seed を一括 | **データが消える**。まっさらに作り直す |

### マイグレーション / シード
| コマンド | 何をする | 備考 |
|---|---|---|
| `npm run db:migrate` | 未適用のマイグレーションを適用 | 冪等。`DATABASE_URL` 既定はローカル |
| `npm run db:migrate:status` | 適用済み/未適用の一覧表示 | 変更はしない |
| `npm run db:seed` | 動作確認用データを投入 | 約200店舗+口コミ/予約/通報/営業時間。冪等 |

> マイグレーションの仕組み(`schema_migrations` 表で履歴管理)は [`db/README.md`](../db/README.md)。

---

## 5. 直接DBを操作する(psql)

GUIを使わずにSQLを叩きたいとき(コンテナ内の psql を使う)。

```bash
# 対話シェルに入る
docker exec -it washoku-db psql -U postgres -d washokumap

# 1行だけ実行(例: 店舗数を数える)
docker exec washoku-db psql -U postgres -d washokumap -c "select count(*) from restaurant;"

# SQLファイルを流す(Windowsのパイプ崩れ回避のため cp してから -f 推奨)
docker cp path/to.sql washoku-db:/tmp/x.sql
docker exec washoku-db psql -U postgres -d washokumap -f /tmp/x.sql
```

**テストデータの掃除(バルク投入分だけ削除)**
```bash
docker exec washoku-db psql -U postgres -d washokumap -c "delete from restaurant where id::text like 'bbbb0000-%';"
docker exec washoku-db psql -U postgres -d washokumap -c "delete from app_user where id::text like 'cccc0000-%';"
docker exec washoku-db psql -U postgres -d washokumap -c "delete from reservation where id::text like 'dddd0000-%';"
```

---

## 6. 環境変数(`.env.local`)

`.env.example` をコピーして使う。**未設定でもローカル開発は動く**(メール/翻訳等はログ出力にフォールバック)。

| 変数 | 用途 | 未設定時 |
|---|---|---|
| `DATABASE_URL` | DB接続先 | ローカル既定(`…@localhost:55432/washokumap`)|
| `ADMIN_TOKEN` | 管理API保護 | 開発は開放(本番は必須) |
| `RESEND_API_KEY` 他 | メール送信 | 送らずログ出力 |
| `DEEPL_API_KEY` | 翻訳 | 翻訳なし(原文のみ) |
| `UPLOAD_DIR` | 画像保存先 | `./uploads` |
| `RATE_LIMIT_DISABLED` | レート制限の無効化(テスト用) | 有効 |

> 全変数の詳細は [`admin-guide.md`](./admin-guide.md) §9・§11。`.env*` は Git 管理外。

---

## 7. Git(基本)

```bash
git status                 # 変更点の確認
git add -A                 # 変更をステージ
git commit -m "メッセージ"  # コミット(日本語可)
git push                   # リモート(GitHub)へ反映
git pull                   # 最新を取得 → 後は「シナリオA」へ
```

> コミットメッセージに引用符/括弧を多用するとシェルで壊れることがあります。長文は
> ファイルに書いて `git commit -F message.txt` が安全(CLAUDE.md 参照)。

---

## 8. 困ったとき

| 症状 | 対処 |
|---|---|
| `db:migrate` が接続できない | `npm run db:up` でDB起動を確認。`npm run db:logs` でログ確認。 |
| スキーマがおかしい/壊した | `npm run db:fresh` でまっさらに作り直す(データは消える)。 |
| ポート3000が使用中 | 既存の `npm run dev` を停止。残っていれば node プロセスを終了。 |
| 画像が表示されない | `UPLOAD_DIR`(既定 `./uploads`)に書き込めているか確認。 |
| 検索で429が返る | レート制限。連打テスト時は `RATE_LIMIT_DISABLED=true` を `.env.local` に。 |
| `docker` コマンドが見つからない | Docker Desktop を起動してから再実行。 |
