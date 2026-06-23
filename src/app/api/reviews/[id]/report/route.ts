import { NextResponse, type NextRequest } from "next/server";
import { reportReview } from "@/lib/reviews";
import { getUserIdByAnonymousId } from "@/lib/users";
import {
  enforceRateLimit,
  requestTooLarge,
  MAX_JSON_BYTES,
} from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reviews/[id]/report  body: { reason, anonymousId? }
 * 口コミを通報する(匿名可)。通報は記録のみで、公開状態は運用者が判断する。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;

  const limited = enforceRateLimit(req, "report", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  if (requestTooLarge(req, MAX_JSON_BYTES)) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: { reason?: string; anonymousId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = body.reason?.trim() ?? "";
  if (!reason) {
    return NextResponse.json({ error: "missing_reason" }, { status: 400 });
  }

  // 通報者は任意。既存の app_user があれば紐付け、なければ匿名(null)。
  const anonymousId = body.anonymousId?.trim() || null;
  const reporterUserId = anonymousId
    ? await getUserIdByAnonymousId(anonymousId)
    : null;

  const result = await reportReview(reviewId, reason, reporterUserId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
