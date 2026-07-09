import { NextResponse, type NextRequest } from "next/server";
import { translateReviewBody } from "@/lib/reviews";
import { LOCALES, type Locale } from "@/lib/i18n";
import { enforceRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/[id]/translate?target=en
 * 公開中の口コミ本文を target ロケールへ翻訳して返す。
 * キャッシュ(body_translations)があれば DeepL を呼ばずに返す。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;

  const limited = enforceRateLimit(req, "review_translate", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const target = req.nextUrl.searchParams.get("target") ?? "";
  if (!LOCALES.includes(target as Locale)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  try {
    const result = await translateReviewBody(reviewId, target);
    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "no_body"
            ? 400
            : 503;
      return NextResponse.json({ error: result.reason }, { status });
    }
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("translate review failed:", err);
    return NextResponse.json({ error: "translate_failed" }, { status: 500 });
  }
}
