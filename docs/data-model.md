# WashokuMap データモデル設計

> 対象DB: PostgreSQL 15+ / PostGIS
> Status: Draft / 最終更新: 2026-06-21
> 関連: [`architecture.md`](./architecture.md)

---

## 1. 全体像(ER概要)

```
                            ┌──────────────┐
                            │   app_user   │  匿名 or ログインユーザ
                            └──────┬───────┘
              ┌────────────────────┼────────────────────┬───────────────┐
              │                    │                    │               │
       ┌──────▼──────┐     ┌───────▼───────┐    ┌───────▼──────┐  ┌─────▼──────┐
       │  favorite   │     │ search_history│    │ reservation  │  │   review   │
       └──────┬──────┘     └───────────────┘    └──────┬───────┘  └─────┬──────┘
              │                                         │                │
              │            ┌──────────────┐             │                │
              └───────────▶│  restaurant  │◀────────────┴────────────────┘
                           └──────┬───────┘
              ┌───────────────────┼───────────────────┐
       ┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼────────┐
       │restaurant_   │    │ restaurant_   │    │  genre /        │
       │photo         │    │ hours         │    │ restaurant_genre│
       └──────────────┘    └───────────────┘    └────────────────┘
```

主要エンティティ:
- **app_user** — 匿名/ログインを一元管理するユーザ
- **auth_identity** — OAuth(Google/Apple)等の外部ID
- **restaurant** — 店舗(本体)
- **restaurant_photo / restaurant_hours / genre** — 店舗付随情報
- **favorite / search_history** — ユーザ行動データ
- **reservation** — リクエスト型予約
- **review** — 口コミ・評価

---

## 2. ユーザー・認証

### app_user
匿名トークンでもログインでも、まず必ず1行作る。サインインで匿名行を昇格させる。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | 内部ID |
| anonymous_id | uuid UNIQUE NULL | 端末発行の匿名トークン(localStorageと一致) |
| is_registered | boolean | OAuth連携済みなら true |
| display_name | text NULL | 表示名(任意) |
| email | citext NULL | ログイン/通知用(任意) |
| preferred_lang | text | 既定表示言語(例: en, ja, zh-Hans) |
| default_contact | jsonb NULL | 予約オートフィル用(氏名/電話/メール) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> `default_contact` をサーバに置くのはログイン時のみ。匿名時は原則 localStorage に保持し、サーバには予約作成時にのみ渡す。

### auth_identity
1ユーザに複数プロバイダを紐付け可能。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→app_user | |
| provider | text | google / apple |
| provider_user_id | text | プロバイダ側の一意ID |
| created_at | timestamptz | |

制約: `UNIQUE(provider, provider_user_id)`

### 匿名→ログイン統合(マージ)
サインイン時の処理:
1. `provider_user_id` で既存 `app_user` を検索。
2. なければ現在の匿名 `app_user` を `is_registered=true` に昇格。
3. あれば、匿名ユーザの favorite / search_history / reservation / review を既存ユーザへ付け替え、匿名行は削除 or 統合。

---

## 3. 店舗

### restaurant

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| name | text | 店名(日本語) |
| name_translations | jsonb | {"en":"...","zh-Hans":"..."} 多言語名 |
| description | text NULL | 紹介文(原文) |
| description_translations | jsonb | 多言語紹介文 |
| address | text | 住所 |
| location | geography(Point,4326) | 緯度経度(PostGIS、地理検索用) |
| phone | text NULL | 電話番号(tel:リンク/予約デスク用) |
| website_url | text NULL | 公式サイト |
| listing_type | text | `unlisted`(非掲載=主ターゲット)/ `listed` |
| reservation_mode | text | `request`(リクエスト型)/ `external`(外部URL)/ `phone_only` |
| reservation_url | text NULL | 外部予約ページ(食べログ/一休等) |
| price_range | int2 NULL | 1〜4(¥〜¥¥¥¥) |
| rating_avg | numeric(2,1) | 口コミ平均(キャッシュ) |
| rating_count | int | 口コミ件数(キャッシュ) |
| status | text | `draft` / `published` / `closed` |
| source | text | データ取得元(`manual` 人手登録 など) |
| search_vector | tsvector | 全文検索インデックス(名前/ジャンル/住所) |
| created_at / updated_at | timestamptz | |

インデックス:
- `GIST(location)` — 半径検索
- `GIN(search_vector)` — 全文検索
- `GIN(name_translations jsonb_path_ops)` — 多言語名検索(必要に応じ)

> `reservation_mode` が予約UIの分岐キー。`request`→アプリ内フォーム、`external`→`reservation_url`へ、`phone_only`→電話ボタンのみ。

### genre / restaurant_genre(多対多)
和食のジャンル(寿司/天ぷら/蕎麦/居酒屋/懐石…)。

```
genre(id, code, name_translations jsonb)
restaurant_genre(restaurant_id, genre_id)   -- PK複合
```

### restaurant_photo

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| url | text | 画像URL(ストレージ) |
| caption | text NULL | |
| sort_order | int | 表示順 |
| is_primary | boolean | 代表画像 |

### restaurant_hours
営業時間。曜日 × 区間で表現(昼/夜の二部営業に対応)。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| day_of_week | int2 | 0=日 … 6=土 |
| open_time | time | |
| close_time | time | |
| note | text NULL | 例: ラストオーダー、定休日特記 |

### import_batch(CSVインポート履歴)
一括投入の実行単位を記録し、失敗行の再投入・出所追跡に使う。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| filename | text | アップロードしたCSV名 |
| uploaded_by | uuid FK→app_user | 実行した運用者 |
| total_rows | int | 総行数 |
| success_count | int | 取込成功数 |
| error_count | int | 失敗数 |
| error_report | jsonb NULL | 行番号・理由のリスト |
| status | text | pending / validating / completed / failed |
| created_at | timestamptz | |

関連: 取り込まれた `restaurant` は `source='csv'` とし、必要なら `import_batch_id` 列で由来を辿れるようにする。重複判定キー(電話番号 or 店名+住所)で upsert する。

---

## 4. ユーザー行動データ

### favorite

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→app_user | |
| restaurant_id | uuid FK | |
| created_at | timestamptz | |

制約: `UNIQUE(user_id, restaurant_id)`
> 匿名時はクライアントのlocalStorageが主。ログイン時にこのテーブルへ同期/マージ。

### search_history

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→app_user | |
| query | text | 入力語句 |
| filters | jsonb NULL | ジャンル/価格/位置などの絞り込み |
| searched_at | timestamptz | |

> プライバシー上、保持期間に上限を設ける(例: 直近50件/90日)。匿名時はlocalStorage主。

---

## 5. 予約(リクエスト型)

### reservation

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| user_id | uuid FK→app_user NULL | 匿名予約は anonymous 紐付け |
| status | text | requested / confirmed / declined / counter_offer / cancelled / completed / no_show |
| party_size | int2 | 人数 |
| desired_at | timestamptz | 第1希望日時 |
| desired_alt_at | timestamptz NULL | 代替希望 |
| guest_name | text | 予約者名 |
| guest_email | citext NULL | |
| guest_phone | text NULL | |
| guest_lang | text | 客の言語(翻訳・返信用) |
| requests | text NULL | 自由要望(原文) |
| requests_ja | text NULL | 店舗向け日本語訳 |
| dietary | jsonb NULL | アレルギー/宗教制限/ベジ等の定型項目 |
| budget_per_person | int NULL | 予算 |
| confirmed_at | timestamptz NULL | |
| handled_by | text NULL | 予約デスク担当者 or 'store' |
| created_at / updated_at | timestamptz | |

インデックス: `(restaurant_id, status)`, `(user_id)`, `(desired_at)`

### reservation_event(状態遷移の監査ログ)
誰がいつステータスを変えたか、店舗とのやり取りを記録。人手運用のため重要。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| reservation_id | uuid FK | |
| from_status | text NULL | |
| to_status | text | |
| channel | text NULL | email / sms / phone / fax / desk |
| note | text NULL | 店舗回答メモ等 |
| actor | text | system / desk:担当者 / store / user |
| created_at | timestamptz | |

> `dietary` 例:
> ```json
> { "allergies": ["shrimp","soba"], "religion": "halal", "vegetarian": false }
> ```

---

## 6. 口コミ・評価

### review

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| restaurant_id | uuid FK | |
| user_id | uuid FK→app_user | 投稿者 |
| reservation_id | uuid FK NULL | 予約実績との紐付け(任意・信頼度向上) |
| rating | int2 | 1〜5 |
| body | text NULL | 本文(原文) |
| body_lang | text | 投稿言語 |
| body_translations | jsonb | オンデマンド翻訳キャッシュ |
| status | text | published / pending / hidden / reported |
| created_at / updated_at | timestamptz | |

制約・方針:
- `UNIQUE(restaurant_id, user_id)` … 1ユーザ1店舗1件(編集は更新)。
- **投稿資格(決定事項)**: 当該店舗で **`status` が `confirmed` または `completed` の reservation を持つユーザのみ**投稿可。**匿名ユーザでも予約実績があれば可**。
  - 検証クエリ例:
    ```sql
    SELECT EXISTS (
      SELECT 1 FROM reservation
      WHERE restaurant_id = :rid
        AND user_id = :uid
        AND status IN ('confirmed','completed')
    );
    ```
  - `reservation_id` 列に紐づけて、どの予約に基づく口コミかを記録(信頼性表示にも利用)。
- 投稿/更新時に `restaurant.rating_avg` と `rating_count` を再計算(トリガ or アプリ層)。

### review_report(通報)
モデレーション用。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| review_id | uuid FK | |
| reporter_user_id | uuid FK NULL | |
| reason | text | |
| created_at | timestamptz | |

将来拡張(多軸評価): `review_aspect(review_id, aspect, score)` で 料理/接客/雰囲気/コスパ を保持。

---

## 7. 多言語の扱い

| パターン | 方式 | 適用先 |
|---|---|---|
| 人手で用意する確定訳 | `*_translations jsonb` 列 | 店名・紹介文・ジャンル |
| 機械翻訳のキャッシュ | `*_translations jsonb`(オンデマンド充填) | 口コミ・予約要望 |
| UI文言 | フロントの i18n リソース(DB外) | ボタン/ラベル等 |

`jsonb` 例:
```json
{ "ja": "鮨 田中", "en": "Sushi Tanaka", "zh-Hans": "寿司田中" }
```

---

## 8. 代表的なクエリ例

### 地理 + 全文検索(検索画面)
```sql
SELECT r.id, r.name, r.rating_avg,
       ST_Distance(r.location, ST_MakePoint(:lng, :lat)::geography) AS dist_m
FROM restaurant r
WHERE r.status = 'published'
  AND ST_DWithin(r.location, ST_MakePoint(:lng, :lat)::geography, :radius_m)
  AND (:q = '' OR r.search_vector @@ websearch_to_tsquery('simple', :q))
ORDER BY dist_m
LIMIT 50;
```

### 店舗の予約方式に応じたUI分岐(擬似)
```
if reservation_mode == 'request'  -> アプリ内リクエストフォーム
if reservation_mode == 'external' -> reservation_url へ遷移
if reservation_mode == 'phone_only' -> tel: ボタンのみ
```

---

## 9. 設計上の注意・決定事項

1. **匿名予約もサーバ保存**: 予約は店舗・予約デスクと共有する業務データのため、ブラウザのみでは成立しない。`user_id` は匿名 `app_user` を指す。
2. **個人情報の最小化**: `default_contact` のサーバ保存はログイン時のみ。匿名時は予約作成時にのみPIIを受け取る。保持期間・削除手段(APPI/GDPR)を用意。
3. **評価のキャッシュ列**: 検索の高速化のため `restaurant.rating_avg/count` を非正規化。整合は更新時再計算で担保。
4. **拡張余地**: `reservation_mode` / `listing_type` を列で持つことで、非掲載店→既存予約システム連携へ段階移行できる。
5. **監査性**: 人手運用ゆえ `reservation_event` で全状態遷移を追跡可能にする。

---

## 10. 決定事項・未確定事項

### 決定済み
- **店舗データ投入**: 人手登録UI と CSVインポートの**両方**を用意(`import_batch` で履歴管理、`source` で出所区別)。
- **口コミ投稿資格**: 当該店で予約実績(`confirmed`/`completed`)があるユーザのみ。**匿名でも予約実績があれば可**。

### 未確定(要相談)
- 翻訳をオンデマンド都度実行にするか、バッチで事前生成するか(コストと鮮度のトレードオフ)
- 予約デスクの運用フロー(通知先・SLA・代行確認の範囲)
- CSVの重複判定キーを「電話番号」と「店名+住所」のどちらを優先するか
