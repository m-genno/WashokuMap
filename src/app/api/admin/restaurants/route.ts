import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { createRestaurant, type RestaurantInput } from "@/lib/adminRestaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = ["request", "external", "phone_only"];

/** POST /api/admin/restaurants — 人手登録(1店舗) */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RestaurantInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (body.reservationMode && !MODES.includes(body.reservationMode)) {
    return NextResponse.json(
      { error: "invalid_reservation_mode" },
      { status: 400 }
    );
  }
  if (
    body.priceRange != null &&
    (!Number.isInteger(body.priceRange) ||
      body.priceRange < 1 ||
      body.priceRange > 4)
  ) {
    return NextResponse.json({ error: "invalid_price_range" }, { status: 400 });
  }

  try {
    const saved = await createRestaurant({ ...body, source: "manual" });
    return NextResponse.json({ restaurant: saved }, { status: 201 });
  } catch (err) {
    console.error("admin create restaurant failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
