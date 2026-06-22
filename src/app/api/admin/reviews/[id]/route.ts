import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { setReviewStatus, isModerationStatus } from "@/lib/reviews";
import { recordAdminAudit, adminActor } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/reviews/[id]  body: { status: 'published' | 'hidden' }
 * 口コミを非表示/公開へ。評価キャッシュは DB トリガが再計算する。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.status || !isModerationStatus(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const updated = await setReviewStatus(id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await recordAdminAudit({
      action: "review.moderate",
      targetType: "review",
      targetId: id,
      summary: `口コミ: ${body.status === "hidden" ? "非表示" : "公開"}`,
      detail: { status: body.status },
      actor: adminActor(req),
    });
    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("admin set review status failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
