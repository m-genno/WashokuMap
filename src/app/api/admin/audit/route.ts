import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { listAdminAudit } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit?action=...&limit=...
 * 管理操作の監査ログ一覧(新しい順)。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const entries = await listAdminAudit({
      action: action && action !== "all" ? action : null,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ count: entries.length, entries });
  } catch (err) {
    console.error("admin list audit failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
