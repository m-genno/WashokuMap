import { type NextRequest } from "next/server";

/**
 * 管理APIの簡易保護。
 * ADMIN_TOKEN が設定されていれば x-admin-token ヘッダ一致を必須にする。
 * 未設定なら開放(開発用)— 本番では必ず ADMIN_TOKEN を設定すること。
 * 認証(Google/Apple + staff/admin ロール)実装時にここを置き換える。
 */
export function isAdminAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.warn(
      "[admin] ADMIN_TOKEN is not set; admin API is OPEN (dev only)."
    );
    return true;
  }
  return req.headers.get("x-admin-token") === expected;
}
