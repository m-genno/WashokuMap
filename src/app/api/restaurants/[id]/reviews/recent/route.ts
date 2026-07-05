import { NextResponse, type NextRequest } from "next/server";
import { listRecentReviews } from "@/lib/reviews";
import { enforceRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/restaurants/[id]/reviews/recent?page=1&perPage=5
 * 公開中の口コミを新しい順に返す(検索結果プレビュー・詳細画面のページング用)。
 * page は1始まり、perPage 既定5・最大20。total で総件数を返す。
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

  const sp = req.nextUrl.searchParams;
  const pageRaw = Number(sp.get("page"));
  const perPageRaw = Number(sp.get("perPage"));
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw >= 1
      ? Math.min(Math.floor(perPageRaw), 20)
      : 5;

  const { id } = await params;
  try {
    const { reviews, total } = await listRecentReviews(id, {
      limit: perPage,
      offset: (page - 1) * perPage,
    });
    return NextResponse.json({
      count: reviews.length,
      total,
      page,
      perPage,
      reviews,
    });
  } catch (err) {
    console.error("recent reviews failed:", err);
    return NextResponse.json({ error: "reviews_failed" }, { status: 500 });
  }
}
