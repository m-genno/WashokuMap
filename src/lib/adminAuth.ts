import { type NextRequest } from "next/server";

/**
 * 管理APIの簡易保護。
 * x-admin-token ヘッダが ADMIN_TOKEN と一致する場合のみ許可する。
 * ADMIN_TOKEN 未設定時は常に拒否(fail-closed)— 開発環境でも .env.local に設定すること。
 * 認証(Google/Apple + staff/admin ロール)実装時にここを置き換える。
 */
export function isAdminAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error(
      "[admin] ADMIN_TOKEN is not set; rejecting all admin API requests. Set ADMIN_TOKEN in .env.local (see .env.example)."
    );
    return false;
  }
  return req.headers.get("x-admin-token") === expected;
}
