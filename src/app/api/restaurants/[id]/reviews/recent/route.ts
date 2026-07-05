import { NextResponse, type NextRequest } from "next/server";
import { listRecentReviews } from "@/lib/reviews";
import { enforceRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/restaurants/[id]/reviews/recent
 * 検索結果の口コミプレビュー用に、公開中の最新口コミ(最大5件)を返す。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = enforceRateLimit(req, "reviews_recent", {
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { id } = await params;
  try {
    const reviews = await listRecentReviews(id, 5);
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("recent reviews failed:", err);
    return NextResponse.json({ error: "reviews_failed" }, { status: 500 });
  }
}
