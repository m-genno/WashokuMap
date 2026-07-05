import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { listAdminAudit } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit?action=...&page=1&perPage=100
 * 管理操作の監査ログ一覧(新しい順)。page は1始まり。total で総件数を返す。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const action = sp.get("action");
  const pageRaw = Number(sp.get("page"));
  const perPageRaw = Number(sp.get("perPage"));
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw >= 1
      ? Math.min(Math.floor(perPageRaw), 500)
      : 100;

  try {
    const { entries, total } = await listAdminAudit({
      action: action && action !== "all" ? action : null,
      limit: perPage,
      offset: (page - 1) * perPage,
    });
    return NextResponse.json({
      count: entries.length,
      total,
      page,
      perPage,
      entries,
    });
  } catch (err) {
    console.error("admin list audit failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
