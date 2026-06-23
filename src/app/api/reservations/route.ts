import { NextResponse, type NextRequest } from "next/server";
import { getRestaurantById } from "@/lib/restaurants";
import { createReservation } from "@/lib/reservations";
import {
  sendReservationNotification,
  recordNotificationEvent,
} from "@/lib/notifications";
import { translateToJa } from "@/lib/translation";
import { getOrCreateUserByAnonymousId } from "@/lib/users";
import {
  enforceRateLimit,
  requestTooLarge,
  clampLen,
  MAX_JSON_BYTES,
} from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReservationBody {
  restaurantId?: string;
  anonymousId?: string | null;
  desiredAt?: string;
  desiredAltAt?: string | null;
  partySize?: number;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestLang?: string;
  requests?: string | null;
  dietary?: Record<string, unknown> | null;
  budgetPerPerson?: number | null;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * POST /api/reservations
 * リクエスト型予約(reservation_mode='request')の店舗にリクエストを作成する。
 */
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "reservations", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  if (requestTooLarge(req, MAX_JSON_BYTES)) return bad("payload_too_large", 413);

  let body: ReservationBody;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const { restaurantId, desiredAt, guestLang } = body;
  const guestName = clampLen(body.guestName, 100);
  if (!restaurantId || !desiredAt || !guestName) {
    return bad("missing_required_fields");
  }

  const partySize = Number(body.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    return bad("invalid_party_size");
  }

  const when = new Date(desiredAt);
  if (Number.isNaN(when.getTime())) {
    return bad("invalid_desired_at");
  }

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) return bad("restaurant_not_found", 404);
  if (restaurant.reservation_mode !== "request") {
    return bad("restaurant_not_request_mode");
  }

  try {
    const guestEmail = clampLen(body.guestEmail?.trim(), 200) || null;
    const guestPhone = clampLen(body.guestPhone?.trim(), 40) || null;
    const budgetPerPerson =
      body.budgetPerPerson != null ? Number(body.budgetPerPerson) : null;
    const requests = clampLen(body.requests?.trim(), 1000) || null;
    const lang = clampLen(guestLang, 16) || "en";

    // 匿名IDがあれば app_user に紐付ける(後の口コミ投稿資格の判定に使う)。
    const anonymousId = body.anonymousId?.trim() || null;
    const userId = anonymousId
      ? await getOrCreateUserByAnonymousId(anonymousId)
      : null;

    // 要望を日本語へ翻訳(未接続なら null)。失敗が予約を妨げないよう保護。
    let requestsJa: string | null = null;
    try {
      requestsJa = await translateToJa(requests, lang);
    } catch (translateErr) {
      console.error("reservation translation failed:", translateErr);
    }

    const reservation = await createReservation({
      restaurantId,
      desiredAt: when.toISOString(),
      desiredAltAt: body.desiredAltAt
        ? new Date(body.desiredAltAt).toISOString()
        : null,
      partySize,
      guestName: guestName.trim(),
      guestEmail,
      guestPhone,
      guestLang: lang,
      requests,
      requestsJa,
      dietary: body.dietary ?? null,
      budgetPerPerson,
      userId,
    });

    // 店舗/予約デスクへ通知。失敗しても予約自体は成立させる。
    try {
      const result = await sendReservationNotification({
        id: reservation.id,
        restaurantName: restaurant.name,
        restaurantPhone: restaurant.phone,
        desiredAt: reservation.desired_at,
        desiredAltAt: body.desiredAltAt
          ? new Date(body.desiredAltAt).toISOString()
          : null,
        partySize,
        guestName: guestName.trim(),
        guestEmail,
        guestPhone,
        guestLang: lang,
        requests: reservation.requests,
        requestsJa: reservation.requests_ja,
        dietary: body.dietary ?? null,
        budgetPerPerson,
      });
      await recordNotificationEvent(reservation.id, result);
    } catch (notifyErr) {
      console.error("reservation notification failed:", notifyErr);
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    console.error("create reservation failed:", err);
    return bad("reservation_failed", 500);
  }
}
