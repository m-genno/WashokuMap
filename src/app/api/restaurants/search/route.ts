import { NextResponse, type NextRequest } from "next/server";
import { searchRestaurants } from "@/lib/restaurants";
import { enforceRateLimit, clampLen } from "@/lib/rateLimit";

// pg は Node ランタイムが必要(Edge 不可)。毎リクエスト動的実行。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/restaurants/search
 *   ?q=寿司&lat=35.658&lng=139.70&radius=3000&genre=sushi&limit=50&page=1
 * すべて任意。lat/lng が両方あるときだけ地理検索を行う。
 * page は1始まり(1ページ = limit 件)。total で総件数を返す。
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "search", {
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;
  const numParam = (key: string): number | undefined => {
    const raw = sp.get(key);
    if (raw === null || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  const limit = Math.min(Math.max(numParam("limit") ?? 50, 1), 100);
  const pageRaw = numParam("page");
  const page = pageRaw && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  try {
    const { results, total } = await searchRestaurants({
      q: clampLen(sp.get("q") ?? undefined, 200),
      lat: numParam("lat"),
      lng: numParam("lng"),
      radiusM: numParam("radius"),
      genre: sp.get("genre") ?? undefined,
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({
      count: results.length,
      total,
      page,
      perPage: limit,
      results,
    });
  } catch (err) {
    console.error("restaurant search failed:", err);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
