import { pool, query } from "./db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_REASON_MAX = 500;

/** 投稿資格とみなす予約ステータス(=来店実績ありとみなす)。 */
const QUALIFYING_STATUSES = ["confirmed", "completed"] as const;

export const MAX_REVIEW_PHOTOS = 4;

/** 口コミ写真。url=表示用(<=1600px) / thumbUrl=サムネ(<=400px)。 */
export interface ReviewPhoto {
  url: string;
  thumbUrl: string | null;
}

export interface MyReview {
  rating: number;
  body: string | null;
  body_lang: string;
  photos: ReviewPhoto[];
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
      `SELECT rating, body, body_lang,
              COALESCE(
                (SELECT json_agg(
                          json_build_object('url', rp.url, 'thumbUrl', rp.thumb_url)
                          ORDER BY rp.sort_order)
                 FROM review_photo rp WHERE rp.review_id = review.id),
                '[]'
              ) AS photos
       FROM review
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
  /** 添付写真(表示用/サムネのURL対)。未指定なら写真は変更しない。 */
  photos?: ReviewPhoto[];
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query<UpsertedReview>(
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
    const review = rows.rows[0];

    // 写真が指定されていれば総入れ替え(編集時の差し替えにも対応)。
    if (input.photos) {
      const pics = input.photos.slice(0, MAX_REVIEW_PHOTOS);
      await client.query(`DELETE FROM review_photo WHERE review_id = $1`, [
        review.id,
      ]);
      for (let i = 0; i < pics.length; i++) {
        await client.query(
          `INSERT INTO review_photo (review_id, url, thumb_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [review.id, pics[i].url, pics[i].thumbUrl ?? null, i]
        );
      }
    }

    await client.query("COMMIT");
    return review;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---- モデレーション(通報・非表示) ----

export type ReportResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_reason" };

/**
 * 口コミを通報する(匿名可)。reporterUserId は任意(app_user.id か null)。
 * 通報自体は公開状態を変えない(運用者が確認して非表示判断)。
 */
export async function reportReview(
  reviewId: string,
  reason: string,
  reporterUserId: string | null
): Promise<ReportResult> {
  if (!UUID_RE.test(reviewId)) return { ok: false, reason: "not_found" };
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > REPORT_REASON_MAX) {
    return { ok: false, reason: "invalid_reason" };
  }

  const exists = await query<{ id: string }>(
    `SELECT id FROM review WHERE id = $1`,
    [reviewId]
  );
  if (exists.length === 0) return { ok: false, reason: "not_found" };

  await query(
    `INSERT INTO review_report (review_id, reporter_user_id, reason)
     VALUES ($1, $2, $3)`,
    [reviewId, reporterUserId, trimmed]
  );
  return { ok: true };
}

export type ModerationFilter = "reported" | "hidden" | "all";

export interface ModerationReviewRow {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  rating: number;
  body: string | null;
  body_lang: string;
  body_translations: Record<string, string>;
  status: string;
  created_at: string;
  report_count: number;
  reasons: string[];
  photos: ReviewPhoto[];
}

/**
 * モデレーション対象の口コミ一覧。
 * - reported: 公開中で通報のあるもの
 * - hidden:   非表示中のもの
 * - all:      通報があるもの、または非表示中のもの
 */
export async function listReviewsForModeration(opts: {
  filter?: ModerationFilter;
  limit?: number;
}): Promise<ModerationReviewRow[]> {
  const filter = opts.filter ?? "reported";
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  let where = "";
  let having = "HAVING count(rep.id) > 0";
  if (filter === "reported") {
    where = "WHERE rv.status = 'published'";
  } else if (filter === "hidden") {
    where = "WHERE rv.status = 'hidden'";
    having = "";
  } else {
    having = "HAVING count(rep.id) > 0 OR rv.status = 'hidden'";
  }

  return query<ModerationReviewRow>(
    `SELECT
       rv.id, rv.restaurant_id, r.name AS restaurant_name,
       rv.rating, rv.body, rv.body_lang, rv.body_translations,
       rv.status, rv.created_at,
       count(rep.id)::int AS report_count,
       COALESCE(
         (array_agg(rep.reason ORDER BY rep.created_at DESC)
            FILTER (WHERE rep.id IS NOT NULL))[1:5],
         '{}'
       ) AS reasons,
       COALESCE(
         (SELECT json_agg(
                   json_build_object('url', rp.url, 'thumbUrl', rp.thumb_url)
                   ORDER BY rp.sort_order)
          FROM review_photo rp WHERE rp.review_id = rv.id),
         '[]'
       ) AS photos
     FROM review rv
     JOIN restaurant r ON r.id = rv.restaurant_id
     LEFT JOIN review_report rep ON rep.review_id = rv.id
     ${where}
     GROUP BY rv.id, r.name
     ${having}
     ORDER BY count(rep.id) DESC, rv.created_at DESC
     LIMIT ${limit}`
  );
}

const MODERATION_STATUSES = ["published", "hidden"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export function isModerationStatus(s: string): s is ModerationStatus {
  return (MODERATION_STATUSES as readonly string[]).includes(s);
}

/**
 * 口コミを非表示/公開に切り替える。評価キャッシュは DB トリガが再計算
 * (非表示にすると rating_avg/count から除外される)。
 */
export async function setReviewStatus(
  reviewId: string,
  status: ModerationStatus
): Promise<{ id: string; status: string } | null> {
  if (!UUID_RE.test(reviewId)) return null;
  const rows = await query<{ id: string; status: string }>(
    `UPDATE review SET status = $2 WHERE id = $1 RETURNING id, status`,
    [reviewId, status]
  );
  return rows[0] ?? null;
}
