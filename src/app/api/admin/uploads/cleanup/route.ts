import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { cleanupOrphanUploads } from "@/lib/uploads";
import { recordAdminAudit, adminActor } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  dryRun?: boolean;
  olderThanHours?: number;
}

/**
 * POST /api/admin/uploads/cleanup  body: { dryRun?, olderThanHours? }
 * 孤立アップロード画像の確認(dryRun)・削除。実削除時は監査ログに記録。
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // body 省略可(既定: dryRun=false, 24h)
  }

  const dryRun = body.dryRun === true;
  const olderThanHours =
    typeof body.olderThanHours === "number" && Number.isFinite(body.olderThanHours)
      ? body.olderThanHours
      : 24;

  try {
    const report = await cleanupOrphanUploads({ dryRun, olderThanHours });
    if (!dryRun && report.deleted > 0) {
      await recordAdminAudit({
        action: "uploads.cleanup",
        targetType: "uploads",
        summary: `孤立画像を削除: ${report.deleted}件 / ${Math.round(report.freedBytes / 1024)}KB`,
        detail: {
          deleted: report.deleted,
          freedBytes: report.freedBytes,
          olderThanHours,
        },
        actor: adminActor(req),
      });
    }
    return NextResponse.json({ report });
  } catch (err) {
    console.error("admin uploads cleanup failed:", err);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
