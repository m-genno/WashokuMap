import { NextResponse, type NextRequest } from "next/server";
import { getRestaurantById } from "@/lib/restaurants";
import {
  getReviewContext,
  upsertReview,
  MAX_REVIEW_PHOTOS,
  type ReviewContext,
} from "@/lib/reviews";
import { isUploadUrl } from "@/lib/uploads";
import {
  getUserIdByAnonymousId,
  getOrCreateUserByAnonymousId,
} from "@/lib/users";
import { translateToJa } from "@/lib/translation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

const NOT_ELIGIBLE: ReviewContext = {
  eligible: false,
  reservationId: null,
  existing: null,
};

/**
 * GET /api/restaurants/[id]/reviews?anonymousId=...
 * このユーザの投稿資格(予約実績)と既存口コミを返す。フォーム表示の出し分け用。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restaurantId } = await params;
  const anonymousId = req.nextUrl.searchParams.get("anonymousId") ?? "";

  const userId = anonymousId
    ? await getUserIdByAnonymousId(anonymousId)
    : null;
  if (!userId) return NextResponse.json(NOT_ELIGIBLE);

  const context = await getReviewContext(restaurantId, userId);
  return NextResponse.json(context);
}

interface ReviewBody {
  anonymousId?: string;
  rating?: number;
  body?: string | null;
  bodyLang?: string;
  photos?: unknown;
}

/**
 * POST /api/restaurants/[id]/reviews
 * 予約実績(confirmed/completed)のあるユーザのみ投稿可。1ユーザ1店舗1件で upsert。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restaurantId } = await params;

  let payload: ReviewBody;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const anonymousId = payload.anonymousId?.trim() ?? "";
  if (!anonymousId) return bad("missing_anonymous_id");

  const rating = Number(payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return bad("invalid_rating");
  }

  const bodyText = payload.body?.trim() || null;
  const bodyLang = payload.bodyLang?.trim() || "en";

  // 写真URLは自前のアップロード(/api/uploads/...)のみ許可(外部URL混入を防ぐ)。
  const photos = Array.isArray(payload.photos)
    ? payload.photos.filter((p): p is string => typeof p === "string")
    : [];
  if (photos.length > MAX_REVIEW_PHOTOS) return bad("too_many_photos");
  if (!photos.every(isUploadUrl)) return bad("invalid_photo");

  // 店舗の存在(公開)確認。
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) return bad("restaurant_not_found", 404);

  const userId = await getOrCreateUserByAnonymousId(anonymousId);
  if (!userId) return bad("invalid_anonymous_id");

  // 投稿資格(予約実績)を検証。
  const context = await getReviewContext(restaurantId, userId);
  if (!context.eligible) return bad("not_eligible", 403);

  // 本文を日本語へ翻訳してキャッシュ(原文は body に保持)。
  // bodyLang が 'ja' のときは原文が日本語なので翻訳不要。失敗は投稿を妨げない。
  const bodyTranslations: Record<string, string> = {};
  if (bodyText && bodyLang !== "ja") {
    try {
      const ja = await translateToJa(bodyText, bodyLang);
      if (ja) bodyTranslations.ja = ja;
    } catch (err) {
      console.error("review translation failed:", err);
    }
  }

  try {
    const review = await upsertReview({
      restaurantId,
      userId,
      reservationId: context.reservationId,
      rating,
      body: bodyText,
      bodyLang,
      bodyTranslations,
      photos,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    console.error("upsert review failed:", err);
    return bad("review_failed", 500);
  }
}
