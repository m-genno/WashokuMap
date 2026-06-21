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
}

/**
 * 予約リクエストを作成する。
 * reservation の作成と初期 reservation_event(→requested)を1トランザクションで行う。
 *
 * 翻訳について:
 *   原文は requests に保存する(設計の「原文＋翻訳併記」の原文側)。
 *   日本語訳 requests_ja は、翻訳APIが未接続のため現状は guest_lang='ja' のときのみ
 *   原文をそのまま入れる。DeepL/Google 接続時にここを差し替える。
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<CreatedReservation> {
  const requestsJa =
    input.guestLang === "ja" ? input.requests ?? null : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query<CreatedReservation>(
      `INSERT INTO reservation
         (restaurant_id, user_id, party_size, desired_at, desired_alt_at,
          guest_name, guest_email, guest_phone, guest_lang,
          requests, requests_ja, dietary, budget_per_person)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, status, desired_at`,
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
  status: string;
  desired_at: string;
  party_size: number;
  guest_name: string;
  restaurant_id: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 予約の状況を取得(不正IDや未存在は null)。 */
export async function getReservationById(
  id: string
): Promise<ReservationStatus | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await query<ReservationStatus>(
    `SELECT id, status, desired_at, party_size, guest_name, restaurant_id
     FROM reservation WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
