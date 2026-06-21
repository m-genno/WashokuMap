import { NextResponse, type NextRequest } from "next/server";
import { searchRestaurants } from "@/lib/restaurants";

// pg は Node ランタイムが必要(Edge 不可)。毎リクエスト動的実行。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/restaurants/search
 *   ?q=寿司&lat=35.658&lng=139.70&radius=3000&genre=sushi&limit=50
 * すべて任意。lat/lng が両方あるときだけ地理検索を行う。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const numParam = (key: string): number | undefined => {
    const raw = sp.get(key);
    if (raw === null || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  try {
    const results = await searchRestaurants({
      q: sp.get("q") ?? undefined,
      lat: numParam("lat"),
      lng: numParam("lng"),
      radiusM: numParam("radius"),
      genre: sp.get("genre") ?? undefined,
      limit: numParam("limit"),
    });
    return NextResponse.json({ count: results.length, results });
  } catch (err) {
    console.error("restaurant search failed:", err);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
