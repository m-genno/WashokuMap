import { query } from "./db";

/** ILIKE のワイルドカード(% _ \)をエスケープする。ESCAPE '\' と併用。 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface RestaurantSearchParams {
  /** 自由語句(店名・住所・多言語名に対する全文検索) */
  q?: string;
  /** 現在地の緯度・経度。両方そろったときだけ地理検索を行う */
  lat?: number;
  lng?: number;
  /** 検索半径(メートル)。既定 3km */
  radiusM?: number;
  /** ジャンル絞り込み(genre.code) */
  genre?: string;
  /** 取得件数(最大 100) */
  limit?: number;
}

export interface RestaurantSearchResult {
  id: string;
  name: string;
  name_translations: Record<string, string>;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating_avg: number;
  rating_count: number;
  price_range: number | null;
  reservation_mode: "request" | "external" | "phone_only";
  primary_photo_url: string | null;
  /** 地理検索時のみ。現在地からの距離(メートル) */
  distance_m: number | null;
}

/**
 * 公開店舗(status='published')を全文検索・地理検索・ジャンルで絞り込む。
 * - lat/lng が両方あれば ST_DWithin で半径内に限定し、距離の近い順に並べる。
 * - なければ評価の高い順。
 */
export async function searchRestaurants(
  params: RestaurantSearchParams
): Promise<RestaurantSearchResult[]> {
  const values: unknown[] = [];
  /** 値を1つ積んで対応するプレースホルダ($n)を返す */
  const bind = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };

  const where: string[] = ["r.status = 'published'"];
  let distanceSelect = "null::float8 AS distance_m";
  let orderBy = "r.rating_avg DESC, r.rating_count DESC";
  let genreJoin = "";

  const hasGeo =
    typeof params.lat === "number" &&
    Number.isFinite(params.lat) &&
    typeof params.lng === "number" &&
    Number.isFinite(params.lng);

  if (hasGeo) {
    const lngPh = bind(params.lng);
    const latPh = bind(params.lat);
    const point = `ST_SetSRID(ST_MakePoint(${lngPh}, ${latPh}), 4326)::geography`;
    const radiusPh = bind(params.radiusM ?? 3000);
    where.push(
      `r.location IS NOT NULL AND ST_DWithin(r.location, ${point}, ${radiusPh})`
    );
    distanceSelect = `ST_Distance(r.location, ${point})::float8 AS distance_m`;
    orderBy = "distance_m ASC";
  }

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim();
    // 全文検索(英数・空白区切り)と、トライグラムによる部分一致(日本語の
    // 途中文字でもヒット)を OR で併用する。'simple' 設定は日本語を語に分割
    // できないため、CJK は ILIKE '%...%' 側が拾う。
    const ftsPh = bind(q);
    const likePh = bind(`%${escapeLike(q)}%`);
    where.push(
      `(r.search_vector @@ websearch_to_tsquery('simple', ${ftsPh})` +
        ` OR r.search_text ILIKE ${likePh} ESCAPE '\\')`
    );
  }

  if (params.genre) {
    genreJoin = `
      JOIN restaurant_genre rg ON rg.restaurant_id = r.id
      JOIN genre g ON g.id = rg.genre_id AND g.code = ${bind(params.genre)}`;
  }

  const limitPh = bind(Math.min(Math.max(params.limit ?? 50, 1), 100));

  const sql = `
    SELECT
      r.id,
      r.name,
      r.name_translations,
      r.address,
      ST_Y(r.location::geometry) AS lat,
      ST_X(r.location::geometry) AS lng,
      r.rating_avg::float8 AS rating_avg,
      r.rating_count,
      r.price_range,
      r.reservation_mode,
      (
        SELECT rp.url FROM restaurant_photo rp
        WHERE rp.restaurant_id = r.id
        ORDER BY rp.is_primary DESC, rp.sort_order ASC
        LIMIT 1
      ) AS primary_photo_url,
      ${distanceSelect}
    FROM restaurant r
    ${genreJoin}
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ${limitPh}
  `;

  return query<RestaurantSearchResult>(sql, values);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RestaurantGenre {
  code: string;
  name_translations: Record<string, string>;
}
export interface RestaurantPhoto {
  url: string;
  caption: string | null;
}
export interface RestaurantHours {
  day_of_week: number; // 0=日 .. 6=土
  open_time: string; // "18:00:00"
  close_time: string;
  note: string | null;
}
export interface RestaurantReview {
  id: string;
  rating: number;
  body: string | null;
  body_lang: string;
  body_translations: Record<string, string>;
  created_at: string;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  name_translations: Record<string, string>;
  description: string | null;
  description_translations: Record<string, string>;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website_url: string | null;
  reservation_mode: "request" | "external" | "phone_only";
  reservation_url: string | null;
  price_range: number | null;
  rating_avg: number;
  rating_count: number;
  genres: RestaurantGenre[];
  photos: RestaurantPhoto[];
  hours: RestaurantHours[];
  reviews: RestaurantReview[];
}

/**
 * 公開店舗(status='published')の詳細を、ジャンル/写真/営業時間/口コミ込みで取得。
 * 見つからない・非公開・不正なIDの場合は null。
 */
export async function getRestaurantById(
  id: string
): Promise<RestaurantDetail | null> {
  if (!UUID_RE.test(id)) return null;

  const rows = await query<Omit<RestaurantDetail, "genres" | "photos" | "hours" | "reviews">>(
    `SELECT
       id, name, name_translations, description, description_translations, address,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng,
       phone, website_url, reservation_mode, reservation_url, price_range,
       rating_avg::float8 AS rating_avg, rating_count
     FROM restaurant
     WHERE id = $1 AND status = 'published'`,
    [id]
  );
  if (rows.length === 0) return null;
  const base = rows[0];

  const [genres, photos, hours, reviews] = await Promise.all([
    query<RestaurantGenre>(
      `SELECT g.code, g.name_translations
       FROM restaurant_genre rg JOIN genre g ON g.id = rg.genre_id
       WHERE rg.restaurant_id = $1 ORDER BY g.code`,
      [id]
    ),
    query<RestaurantPhoto>(
      `SELECT url, caption FROM restaurant_photo
       WHERE restaurant_id = $1 ORDER BY is_primary DESC, sort_order ASC`,
      [id]
    ),
    query<RestaurantHours>(
      `SELECT day_of_week, open_time, close_time, note FROM restaurant_hours
       WHERE restaurant_id = $1 ORDER BY day_of_week, open_time`,
      [id]
    ),
    query<RestaurantReview>(
      `SELECT id, rating, body, body_lang, body_translations, created_at FROM review
       WHERE restaurant_id = $1 AND status = 'published'
       ORDER BY created_at DESC LIMIT 20`,
      [id]
    ),
  ]);

  return { ...base, genres, photos, hours, reviews };
}
