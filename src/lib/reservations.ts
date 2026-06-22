import { pool, query } from "./db";

export interface CreateReservationInput {
  restaurantId: string;
  /** ISO 文字列(第1希望日時) */
  desiredAt: string;
  desiredAltAt?: string | null;
  partySize: number;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestLang: string;
  /** 客が入力した要望(原文) */
  requests?: string | null;
  /** 要望の日本語訳(呼び出し側で翻訳して渡す)。null可 */
  requestsJa?: string | null;
  /** アレルギー/宗教制限/ベジ等の定型項目 */
  dietary?: Record<string, unknown> | null;
  budgetPerPerson?: number | null;
  /** 匿名/ログインユーザの app_user.id(任意) */
  userId?: string | null;
}

export interface CreatedReservation {
  id: string;
  status: string;
  desired_at: string;
  requests: string | null;
  requests_ja: string | null;
}

/**
 * 予約リクエストを作成する。
 * reservation の作成と初期 reservation_event(→requested)を1トランザクションで行う。
 *
 * 翻訳について:
 *   原文は requests に保存する(設計の「原文＋翻訳併記」の原文側)。
 *   日本語訳 requests_ja は呼び出し側(API ルート)で translateToJa して渡す。
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<CreatedReservation> {
  const requestsJa = input.requestsJa ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query<CreatedReservation>(
      `INSERT INTO reservation
         (restaurant_id, user_id, party_size, desired_at, desired_alt_at,
          guest_name, guest_email, guest_phone, guest_lang,
          requests, requests_ja, dietary, budget_per_person)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, status, desired_at, requests, requests_ja`,
      [
        input.restaurantId,
        input.userId ?? null,
        input.partySize,
        input.desiredAt,
        input.desiredAltAt ?? null,
        input.guestName,
        input.guestEmail ?? null,
        input.guestPhone ?? null,
        input.guestLang,
        input.requests ?? null,
        requestsJa,
        input.dietary ? JSON.stringify(input.dietary) : null,
        input.budgetPerPerson ?? null,
      ]
    );
    const reservation = inserted.rows[0];

    await client.query(
      `INSERT INTO reservation_event
         (reservation_id, from_status, to_status, channel, actor, note)
       VALUES ($1, NULL, 'requested', 'desk', 'system', $2)`,
      [reservation.id, "予約リクエストを受け付けました"]
    );

    await client.query("COMMIT");
    return reservation;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface ReservationStatus {
  id: string;
  status: ReservationStatusValue;
  desired_at: string;
  desired_alt_at: string | null;
  party_size: number;
  guest_name: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_name_translations: Record<string, string> | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESERVATION_STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "counter_offer",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

/** 予約デスクが許可する状態遷移。空配列＝終端(以後は変更不可)。 */
const ALLOWED_TRANSITIONS: Record<ReservationStatusValue, ReservationStatusValue[]> =
  {
    requested: ["confirmed", "declined", "counter_offer", "cancelled"],
    counter_offer: ["confirmed", "declined", "cancelled"],
    confirmed: ["completed", "no_show", "cancelled"],
    declined: [],
    cancelled: [],
    completed: [],
    no_show: [],
  };

export interface AdminReservationRow {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: ReservationStatusValue;
  party_size: number;
  desired_at: string;
  desired_alt_at: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_lang: string;
  requests: string | null;
  requests_ja: string | null;
  dietary: Record<string, unknown> | null;
  budget_per_person: number | null;
  created_at: string;
}

/** 予約デスク向けの予約一覧。status 指定で絞り込み(未指定=すべて)。 */
export async function listReservationsForAdmin(opts: {
  status?: ReservationStatusValue | null;
  limit?: number;
}): Promise<AdminReservationRow[]> {
  const status = opts.status ?? null;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  return query<AdminReservationRow>(
    `SELECT
       res.id, res.restaurant_id, r.name AS restaurant_name,
       res.status, res.party_size, res.desired_at, res.desired_alt_at,
       res.guest_name, res.guest_email, res.guest_phone, res.guest_lang,
       res.requests, res.requests_ja, res.dietary, res.budget_per_person,
       res.created_at
     FROM reservation res
     JOIN restaurant r ON r.id = res.restaurant_id
     WHERE ($1::text IS NULL OR res.status = $1)
     ORDER BY res.created_at DESC
     LIMIT $2`,
    [status, limit]
  );
}

/** 状態遷移後にお客様へ通知するため、同トランザクション内で取得する付随情報。 */
export interface ReservationNotifyDetail {
  restaurantName: string;
  restaurantNameTranslations: Record<string, string> | null;
  restaurantPhone: string | null;
  desiredAt: string;
  desiredAltAt: string | null;
  partySize: number;
  guestName: string;
  guestEmail: string | null;
  guestLang: string;
}

export type SetReservationStatusResult =
  | {
      ok: true;
      reservation: {
        id: string;
        status: ReservationStatusValue;
        from_status: ReservationStatusValue;
      };
      detail: ReservationNotifyDetail;
    }
  | { ok: false; reason: "not_found" | "invalid_transition"; from?: ReservationStatusValue };

/**
 * 予約の状態を遷移させ、監査ログ(reservation_event)を1トランザクションで記録する。
 * - 許可されない遷移は invalid_transition で拒否(終端状態からの変更も不可)。
 * - expectedFrom 指定時、現在の状態が一致しなければ invalid_transition で拒否
 *   (お客様操作の競合対策。例: 既に確定済みの予約への二重操作を防ぐ)。
 * - confirmed へ遷移したときは confirmed_at を打刻。
 * - channel は監査ログの記録元(desk/guest 等)。
 */
export async function setReservationStatus(
  id: string,
  toStatus: ReservationStatusValue,
  opts: {
    actor?: string;
    note?: string | null;
    channel?: string;
    expectedFrom?: ReservationStatusValue;
  } = {}
): Promise<SetReservationStatusResult> {
  if (!UUID_RE.test(id)) return { ok: false, reason: "not_found" };

  const actor = opts.actor ?? "desk";
  const channel = opts.channel ?? "desk";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query<{
      status: ReservationStatusValue;
      restaurant_name: string;
      restaurant_name_translations: Record<string, string> | null;
      restaurant_phone: string | null;
      desired_at: string;
      desired_alt_at: string | null;
      party_size: number;
      guest_name: string;
      guest_email: string | null;
      guest_lang: string;
    }>(
      `SELECT res.status,
              r.name  AS restaurant_name,
              r.name_translations AS restaurant_name_translations,
              r.phone AS restaurant_phone,
              res.desired_at, res.desired_alt_at, res.party_size,
              res.guest_name, res.guest_email, res.guest_lang
       FROM reservation res
       JOIN restaurant r ON r.id = res.restaurant_id
       WHERE res.id = $1
       FOR UPDATE OF res`,
      [id]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const row = cur.rows[0];
    const from = row.status;

    if (opts.expectedFrom && from !== opts.expectedFrom) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_transition", from };
    }

    if (!ALLOWED_TRANSITIONS[from]?.includes(toStatus)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_transition", from };
    }

    await client.query(
      `UPDATE reservation
       SET status = $2,
           confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
           handled_by = $3
       WHERE id = $1`,
      [id, toStatus, actor]
    );

    await client.query(
      `INSERT INTO reservation_event
         (reservation_id, from_status, to_status, channel, actor, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, from, toStatus, channel, actor, opts.note ?? null]
    );

    await client.query("COMMIT");
    return {
      ok: true,
      reservation: { id, status: toStatus, from_status: from },
      detail: {
        restaurantName: row.restaurant_name,
        restaurantNameTranslations: row.restaurant_name_translations,
        restaurantPhone: row.restaurant_phone,
        desiredAt: row.desired_at,
        desiredAltAt: row.desired_alt_at,
        partySize: row.party_size,
        guestName: row.guest_name,
        guestEmail: row.guest_email,
        guestLang: row.guest_lang,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** 予約の状況を取得(不正IDや未存在は null)。 */
export async function getReservationById(
  id: string
): Promise<ReservationStatus | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await query<ReservationStatus>(
    `SELECT res.id, res.status, res.desired_at, res.desired_alt_at,
            res.party_size, res.guest_name, res.restaurant_id,
            r.name AS restaurant_name,
            r.name_translations AS restaurant_name_translations
     FROM reservation res
     JOIN restaurant r ON r.id = res.restaurant_id
     WHERE res.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
