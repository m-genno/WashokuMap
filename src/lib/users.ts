import { query } from "./db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 匿名ID(端末発行・localStorage と一致)から app_user.id を引く。
 * 見つからなければ null(登録は副作用を起こさない読み取り専用)。
 */
export async function getUserIdByAnonymousId(
  anonymousId: string
): Promise<string | null> {
  if (!UUID_RE.test(anonymousId)) return null;
  const rows = await query<{ id: string }>(
    `SELECT id FROM app_user WHERE anonymous_id = $1`,
    [anonymousId]
  );
  return rows[0]?.id ?? null;
}

/**
 * 匿名IDに対応する app_user を取得、なければ作成して id を返す。
 * 予約・口コミ投稿など「書き込みを伴う」操作の入口で使う。
 */
export async function getOrCreateUserByAnonymousId(
  anonymousId: string
): Promise<string | null> {
  if (!UUID_RE.test(anonymousId)) return null;
  const rows = await query<{ id: string }>(
    `INSERT INTO app_user (anonymous_id) VALUES ($1)
     ON CONFLICT (anonymous_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [anonymousId]
  );
  return rows[0]?.id ?? null;
}
