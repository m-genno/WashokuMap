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
 * GET /api/admin/reviews?filter=reported|hidden|all
 * モデレーション対象の口コミ一覧。filter 省略時は reported。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "reported";
  if (!FILTERS.includes(filter)) {
    return NextResponse.json({ error: "invalid_filter" }, { status: 400 });
  }

  try {
    const reviews = await listReviewsForModeration({
      filter: filter as ModerationFilter,
    });
    return NextResponse.json({ count: reviews.length, reviews });
  } catch (err) {
    console.error("admin list reviews failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
