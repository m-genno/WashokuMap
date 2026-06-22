import { pool, query } from "./db";
import { geocodeAddress } from "./geocode";

const RESERVATION_MODES = ["request", "external", "phone_only"] as const;
type ReservationMode = (typeof RESERVATION_MODES)[number];

/** ILIKE のワイルドカード(% _ \)をエスケープする。ESCAPE '\' と併用。 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface RestaurantInput {
  name: string;
  nameEn?: string | null;
  description?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  websiteUrl?: string | null;
  genres?: string[]; // genre codes
  reservationMode?: ReservationMode;
  reservationUrl?: string | null;
  priceRange?: number | null;
  listingType?: "unlisted" | "listed";
  status?: "draft" | "published";
  source?: "manual" | "csv";
  importBatchId?: string | null;
}

export interface SavedRestaurant {
  id: string;
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
}

function nameTranslations(nameEn?: string | null): Record<string, string> {
  return nameEn && nameEn.trim() ? { en: nameEn.trim() } : {};
}

/** genre code 配列を restaurant_genre に紐付け(既知コードのみ、重複無視)。 */
async function linkGenres(
  restaurantId: string,
  codes: string[] | undefined
): Promise<void> {
  if (!codes || codes.length === 0) return;
  await query(
    `INSERT INTO restaurant_genre (restaurant_id, genre_id)
     SELECT $1, g.id FROM genre g WHERE g.code = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [restaurantId, codes]
  );
}

/** 住所しかないとき緯度経度をジオコーディングで補完。lat/lng があればそれを使う。 */
async function resolveLocation(
  input: RestaurantInput
): Promise<{ lat: number | null; lng: number | null; geocoded: boolean }> {
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    return { lat: input.lat, lng: input.lng, geocoded: false };
  }
  const geo = await geocodeAddress(input.address);
  if (geo) return { lat: geo.lat, lng: geo.lng, geocoded: true };
  return { lat: null, lng: null, geocoded: false };
}

function locationSql(lat: number | null, lng: number | null): string {
  return lat != null && lng != null
    ? `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
    : "NULL";
}

/** 単一店舗を作成(人手登録UI)。住所からジオコーディングして location を補完。 */
export async function createRestaurant(
  input: RestaurantInput
): Promise<SavedRestaurant> {
  const loc = await resolveLocation(input);
  const rows = await query<{ id: string }>(
    `INSERT INTO restaurant
       (name, name_translations, description, address, location, phone,
        website_url, listing_type, reservation_mode, reservation_url,
        price_range, status, source, import_batch_id)
     VALUES ($1,$2,$3,$4,${locationSql(loc.lat, loc.lng)},$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      input.name,
      JSON.stringify(nameTranslations(input.nameEn)),
      input.description ?? null,
      input.address ?? null,
      input.phone ?? null,
      input.websiteUrl ?? null,
      input.listingType ?? "unlisted",
      input.reservationMode ?? "request",
      input.reservationUrl ?? null,
      input.priceRange ?? null,
      input.status ?? "draft",
      input.source ?? "manual",
      input.importBatchId ?? null,
    ]
  );
  const id = rows[0].id;
  await linkGenres(id, input.genres);
  return { id, lat: loc.lat, lng: loc.lng, geocoded: loc.geocoded };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESTAURANT_STATUSES = ["draft", "published", "closed"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export interface AdminRestaurantRow {
  id: string;
  name: string;
  name_translations: Record<string, string>;
  address: string | null;
  phone: string | null;
  reservation_mode: ReservationMode;
  price_range: number | null;
  status: RestaurantStatus;
  source: string;
  has_location: boolean;
  genres: string[];
  created_at: string;
}

/**
 * 管理用の店舗一覧。status を指定すると絞り込み(未指定=すべて)。
 * q を指定すると公開検索と同じ全文検索+トライグラム部分一致で絞り込む
 * (店名・住所・多言語名・紹介文。日本語の途中文字でもヒット)。
 * 公開判定や口コミと違い status フィルタを掛けないので下書きも見える。
 */
export async function listRestaurantsForAdmin(opts: {
  status?: RestaurantStatus | null;
  q?: string | null;
  limit?: number;
}): Promise<AdminRestaurantRow[]> {
  const status = opts.status ?? null;
  const q = opts.q?.trim() || null;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  const values: unknown[] = [status];
  let where = "($1::text IS NULL OR r.status = $1)";
  if (q) {
    values.push(q);
    const ftsPh = `$${values.length}`;
    values.push(`%${escapeLike(q)}%`);
    const likePh = `$${values.length}`;
    where +=
      ` AND (r.search_vector @@ websearch_to_tsquery('simple', ${ftsPh})` +
      ` OR r.search_text ILIKE ${likePh} ESCAPE '\\')`;
  }
  values.push(limit);
  const limitPh = `$${values.length}`;

  return query<AdminRestaurantRow>(
    `SELECT
       r.id, r.name, r.name_translations, r.address, r.phone,
       r.reservation_mode, r.price_range, r.status, r.source,
       (r.location IS NOT NULL) AS has_location,
       r.created_at,
       COALESCE(
         array_agg(g.code) FILTER (WHERE g.code IS NOT NULL), '{}'
       ) AS genres
     FROM restaurant r
     LEFT JOIN restaurant_genre rg ON rg.restaurant_id = r.id
     LEFT JOIN genre g ON g.id = rg.genre_id
     WHERE ${where}
     GROUP BY r.id
     ORDER BY r.created_at DESC
     LIMIT ${limitPh}`,
    values
  );
}

/** 店舗のステータスを変更(公開/下書きに戻す/休止)。未存在や不正IDは null。 */
export async function setRestaurantStatus(
  id: string,
  status: RestaurantStatus
): Promise<{ id: string; name: string; status: RestaurantStatus } | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await query<{ id: string; name: string; status: RestaurantStatus }>(
    `UPDATE restaurant SET status = $2 WHERE id = $1
     RETURNING id, name, status`,
    [id, status]
  );
  return rows[0] ?? null;
}

/** 編集フォーム用の単一店舗(下書き含む全状態・全編集項目)。 */
export interface AdminRestaurantDetail {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website_url: string | null;
  reservation_mode: ReservationMode;
  reservation_url: string | null;
  price_range: number | null;
  status: RestaurantStatus;
  source: string;
  genres: string[];
}

/** 編集対象の店舗を取得(状態を問わない)。未存在や不正IDは null。 */
export async function getRestaurantForAdmin(
  id: string
): Promise<AdminRestaurantDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await query<AdminRestaurantDetail>(
    `SELECT
       r.id, r.name,
       r.name_translations->>'en' AS name_en,
       r.description, r.address,
       ST_Y(r.location::geometry) AS lat,
       ST_X(r.location::geometry) AS lng,
       r.phone, r.website_url, r.reservation_mode, r.reservation_url,
       r.price_range, r.status, r.source,
       COALESCE(
         array_agg(g.code) FILTER (WHERE g.code IS NOT NULL), '{}'
       ) AS genres
     FROM restaurant r
     LEFT JOIN restaurant_genre rg ON rg.restaurant_id = r.id
     LEFT JOIN genre g ON g.id = rg.genre_id
     WHERE r.id = $1
     GROUP BY r.id`,
    [id]
  );
  return rows[0] ?? null;
}

export type UpdateRestaurantResult =
  | { ok: true; restaurant: SavedRestaurant }
  | { ok: false; reason: "not_found" | "no_location_for_publish" };

/**
 * 既存店舗を編集(人手UI)。住所/緯度経度から location を解決し、
 * 店名英訳(name_translations.en)とジャンルを更新する。
 * - lat/lng を渡せばその座標を使い、無ければ住所からジオコーディング。
 *   フォームは現在の座標を初期表示するため、通常は位置情報を保持する。
 * - listing_type と source は維持(本フォームの編集対象外)。
 * - status='published' にするには location 必須。
 * - 名前の他言語訳(ja/zh/ko等)は維持し en だけ差し替え(空なら en を削除)。
 */
export async function updateRestaurant(
  id: string,
  input: RestaurantInput
): Promise<UpdateRestaurantResult> {
  if (!UUID_RE.test(id)) return { ok: false, reason: "not_found" };

  const exists = await query<{ id: string }>(
    `SELECT id FROM restaurant WHERE id = $1`,
    [id]
  );
  if (!exists[0]) return { ok: false, reason: "not_found" };

  // ジオコーディング(外部呼び出し)はトランザクション外で先に済ませる。
  const loc = await resolveLocation(input);
  if ((input.status ?? "draft") === "published" && loc.lat == null) {
    return { ok: false, reason: "no_location_for_publish" };
  }

  const nameEn = input.nameEn?.trim() || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE restaurant SET
         name = $2,
         name_translations = CASE
           WHEN $3::text IS NULL THEN name_translations - 'en'
           ELSE name_translations || jsonb_build_object('en', $3::text)
         END,
         description = $4,
         address = $5,
         location = ${locationSql(loc.lat, loc.lng)},
         phone = $6,
         website_url = $7,
         reservation_mode = $8,
         reservation_url = $9,
         price_range = $10,
         status = $11
       WHERE id = $1`,
      [
        id,
        input.name,
        nameEn,
        input.description ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.websiteUrl ?? null,
        input.reservationMode ?? "request",
        input.reservationUrl ?? null,
        input.priceRange ?? null,
        input.status ?? "draft",
      ]
    );

    // ジャンルは差し替え(全削除→再リンク)。
    await client.query(`DELETE FROM restaurant_genre WHERE restaurant_id = $1`, [
      id,
    ]);
    const codes = input.genres ?? [];
    if (codes.length > 0) {
      await client.query(
        `INSERT INTO restaurant_genre (restaurant_id, genre_id)
         SELECT $1, g.id FROM genre g WHERE g.code = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [id, codes]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      restaurant: { id, lat: loc.lat, lng: loc.lng, geocoded: loc.geocoded },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** 重複判定: 電話番号 → なければ 店名+住所。既存IDを返す。 */
async function findExistingId(
  phone: string | null,
  name: string,
  address: string | null
): Promise<string | null> {
  if (phone) {
    const r = await query<{ id: string }>(
      `SELECT id FROM restaurant WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    if (r[0]) return r[0].id;
  }
  const r2 = await query<{ id: string }>(
    `SELECT id FROM restaurant
     WHERE name = $1 AND COALESCE(address,'') = COALESCE($2,'') LIMIT 1`,
    [name, address ?? null]
  );
  return r2[0]?.id ?? null;
}

export interface RowValidationError {
  row: number; // 1-based(ヘッダ除く)
  error: string;
}

export interface ImportResult {
  batchId: string;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: RowValidationError[];
}

/** CSV由来の行を検証して RestaurantInput に変換。失敗時は文字列でエラー理由。 */
export function rowToInput(
  raw: Record<string, string>
): RestaurantInput | string {
  const name = (raw.name ?? "").trim();
  if (!name) return "name は必須です";

  const mode = (raw.reservation_mode ?? "request").trim() || "request";
  if (!RESERVATION_MODES.includes(mode as ReservationMode)) {
    return `reservation_mode が不正です: ${mode}`;
  }

  let priceRange: number | null = null;
  if (raw.price_range && raw.price_range.trim()) {
    const p = Number(raw.price_range);
    if (!Number.isInteger(p) || p < 1 || p > 4) {
      return `price_range は1〜4の整数: ${raw.price_range}`;
    }
    priceRange = p;
  }

  const genres = (raw.genres ?? "")
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name,
    nameEn: raw.name_en?.trim() || null,
    address: raw.address?.trim() || null,
    phone: raw.phone?.trim() || null,
    websiteUrl: raw.website_url?.trim() || null,
    genres,
    reservationMode: mode as ReservationMode,
    reservationUrl: raw.reservation_url?.trim() || null,
    priceRange,
    listingType: mode === "external" ? "listed" : "unlisted",
    source: "csv",
  };
}

/**
 * CSV行(パース済みオブジェクト配列)を一括投入。
 * - 行ごとに検証 → ジオコーディング → 重複なら更新/なければ挿入
 * - import_batch に履歴と失敗レポートを記録
 * 投入直後は status='draft'(確認後に公開)。
 */
export async function importRestaurants(
  rows: Record<string, string>[],
  filename: string
): Promise<ImportResult> {
  const batch = await query<{ id: string }>(
    `INSERT INTO import_batch (filename, total_rows, status)
     VALUES ($1, $2, 'validating') RETURNING id`,
    [filename, rows.length]
  );
  const batchId = batch[0].id;

  const errors: RowValidationError[] = [];
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const parsed = rowToInput(rows[i]);
    if (typeof parsed === "string") {
      errors.push({ row: i + 1, error: parsed });
      continue;
    }
    try {
      const existingId = await findExistingId(
        parsed.phone ?? null,
        parsed.name,
        parsed.address ?? null
      );
      if (existingId) {
        const loc = await resolveLocation(parsed);
        await query(
          `UPDATE restaurant SET
             name=$2, name_translations=$3, address=$4,
             location=${locationSql(loc.lat, loc.lng)},
             phone=$5, website_url=$6, listing_type=$7, reservation_mode=$8,
             reservation_url=$9, price_range=$10, source='csv',
             import_batch_id=$11
           WHERE id=$1`,
          [
            existingId,
            parsed.name,
            JSON.stringify(nameTranslations(parsed.nameEn)),
            parsed.address ?? null,
            parsed.phone ?? null,
            parsed.websiteUrl ?? null,
            parsed.listingType ?? "unlisted",
            parsed.reservationMode ?? "request",
            parsed.reservationUrl ?? null,
            parsed.priceRange ?? null,
            batchId,
          ]
        );
        await linkGenres(existingId, parsed.genres);
        updated++;
      } else {
        await createRestaurant({
          ...parsed,
          status: "draft",
          source: "csv",
          importBatchId: batchId,
        });
        inserted++;
      }
    } catch (err) {
      console.error("[import] row failed:", err);
      errors.push({ row: i + 1, error: "保存に失敗しました" });
    }
  }

  const failed = errors.length;
  await query(
    `UPDATE import_batch
     SET success_count=$2, error_count=$3, error_report=$4, status='completed'
     WHERE id=$1`,
    [batchId, inserted + updated, failed, JSON.stringify(errors)]
  );

  return { batchId, total: rows.length, inserted, updated, failed, errors };
}
