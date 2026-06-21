import { NextResponse, type NextRequest } from "next/server";
import { getRestaurantById } from "@/lib/restaurants";
import { createReservation } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReservationBody {
  restaurantId?: string;
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
  let body: ReservationBody;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const { restaurantId, desiredAt, guestName, guestLang } = body;
  if (!restaurantId || !desiredAt || !guestName) {
    return bad("missing_required_fields");
  }

  const partySize = Number(body.partySize);
  if (!Number.isInteger(partySize) || partySize < 1) {
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
    const reservation = await createReservation({
      restaurantId,
      desiredAt: when.toISOString(),
      desiredAltAt: body.desiredAltAt
        ? new Date(body.desiredAltAt).toISOString()
        : null,
      partySize,
      guestName: guestName.trim(),
      guestEmail: body.guestEmail?.trim() || null,
      guestPhone: body.guestPhone?.trim() || null,
      guestLang: guestLang || "en",
      requests: body.requests?.trim() || null,
      dietary: body.dietary ?? null,
      budgetPerPerson:
        body.budgetPerPerson != null ? Number(body.budgetPerPerson) : null,
    });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    console.error("create reservation failed:", err);
    return bad("reservation_failed", 500);
  }
}
