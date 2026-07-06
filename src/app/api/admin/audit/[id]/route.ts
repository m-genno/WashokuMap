import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { getAdminAuditEntry } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit/[id]
 * 監査ログ1件(操作ログ詳細画面用)。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const entry = await getAdminAuditEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("admin get audit entry failed:", err);
    return NextResponse.json({ error: "get_failed" }, { status: 500 });
  }
}
