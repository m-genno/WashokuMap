import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mayuchan/auth
 * 管理トークンの有効確認(管理画面の表示ゲート用)。
 * 有効なら 200、無効・未設定なら 401。副作用はなく監査ログにも記録しない。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
