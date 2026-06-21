import { query } from "./db";

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
    where.push(
      `r.search_vector @@ websearch_to_tsquery('simple', ${bind(params.q.trim())})`
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
