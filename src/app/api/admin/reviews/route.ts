import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  listReviewsForModeration,
  type ModerationFilter,
} from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS = ["reported", "hidden", "all"];

/**
 * GET /api/admin/reviews?filter=reported|hidden|all&page=1&perPage=50
 * モデレーション対象の口コミ一覧。filter 省略時は reported。
 * page は1始まり。total で総件数を返す。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const filter = sp.get("filter") ?? "reported";
  if (!FILTERS.includes(filter)) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  const pageRaw = Number(sp.get("page"));
  const perPageRaw = Number(sp.get("perPage"));
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw >= 1
      ? Math.min(Math.floor(perPageRaw), 500)
      : 50;

  try {
    const { reviews, total } = await listReviewsForModeration({
      filter: filter as ModerationFilter,
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
    console.error("admin list reviews failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
