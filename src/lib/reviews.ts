import { query } from "./db";

/** 投稿資格とみなす予約ステータス(=来店実績ありとみなす)。 */
const QUALIFYING_STATUSES = ["confirmed", "completed"] as const;

export interface MyReview {
  rating: number;
  body: string | null;
  body_lang: string;
}

export interface ReviewContext {
  /** confirmed/completed の予約があるか(投稿資格) */
  eligible: boolean;
  /** 資格の根拠となる予約ID(最新)。なければ null */
  reservationId: string | null;
  /** この店へのこのユーザの既存口コミ(編集用)。なければ null */
  existing: MyReview | null;
}

/**
 * あるユーザ(app_user.id)の、ある店舗に対する投稿資格と既存口コミを返す。
 * 資格 = その店で confirmed/completed の予約実績がある。
 */
export async function getReviewContext(
  restaurantId: string,
  userId: string
): Promise<ReviewContext> {
  const [reservations, existing] = await Promise.all([
    query<{ id: string }>(
      `SELECT id FROM reservation
       WHERE restaurant_id = $1 AND user_id = $2
         AND status = ANY($3)
       ORDER BY desired_at DESC
       LIMIT 1`,
      [restaurantId, userId, QUALIFYING_STATUSES as unknown as string[]]
    ),
    query<MyReview>(
      `SELECT rating, body, body_lang FROM review
       WHERE restaurant_id = $1 AND user_id = $2`,
      [restaurantId, userId]
    ),
  ]);

  return {
    eligible: reservations.length > 0,
    reservationId: reservations[0]?.id ?? null,
    existing: existing[0] ?? null,
  };
}

export interface UpsertReviewInput {
  restaurantId: string;
  userId: string;
  reservationId: string | null;
  rating: number;
  body: string | null;
  bodyLang: string;
  /** 日本語訳キャッシュ(呼び出し側で translateToJa して渡す)。例: {ja: "..."} */
  bodyTranslations: Record<string, string>;
}

export interface UpsertedReview {
  id: string;
  rating: number;
  body: string | null;
  body_lang: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * 口コミを投稿(または編集)する。1ユーザ1店舗1件(unique 制約)なので upsert。
 * 評価キャッシュ(restaurant.rating_avg/count)は DB トリガが再計算する。
 */
export async function upsertReview(
  input: UpsertReviewInput
): Promise<UpsertedReview> {
  const rows = await query<UpsertedReview>(
    `INSERT INTO review
       (restaurant_id, user_id, reservation_id, rating, body, body_lang,
        body_translations, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'published')
     ON CONFLICT (restaurant_id, user_id) DO UPDATE SET
       reservation_id    = EXCLUDED.reservation_id,
       rating            = EXCLUDED.rating,
       body              = EXCLUDED.body,
       body_lang         = EXCLUDED.body_lang,
       body_translations = EXCLUDED.body_translations,
       status            = 'published'
     RETURNING id, rating, body, body_lang, status, created_at, updated_at`,
    [
      input.restaurantId,
      input.userId,
      input.reservationId,
      input.rating,
      input.body,
      input.bodyLang,
      JSON.stringify(input.bodyTranslations),
    ]
  );
  return rows[0];
}
