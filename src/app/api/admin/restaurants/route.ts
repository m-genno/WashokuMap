import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  createRestaurant,
  listRestaurantsForAdmin,
  validateExtras,
  RESTAURANT_STATUSES,
  type RestaurantInput,
  type RestaurantStatus,
} from "@/lib/adminRestaurants";
import { recordAdminAudit, adminActor } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = ["request", "external", "phone_only"];

/**
 * GET /api/admin/restaurants?status=draft|published|closed|all&q=...
 * 管理用の店舗一覧(下書き含む)。status 省略時は draft、q で語句検索。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("status") ?? "draft";
  let status: RestaurantStatus | null;
  if (raw === "all") {
    status = null;
  } else if (RESTAURANT_STATUSES.includes(raw as RestaurantStatus)) {
    status = raw as RestaurantStatus;
  } else {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const q = req.nextUrl.searchParams.get("q");
  const batch = req.nextUrl.searchParams.get("batch");

  try {
    const restaurants = await listRestaurantsForAdmin({
      status,
      q,
      importBatchId: batch,
    });
    return NextResponse.json({ count: restaurants.length, restaurants });
  } catch (err) {
    console.error("admin list restaurants failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

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
  const extrasError = validateExtras(body);
  if (extrasError) {
    return NextResponse.json({ error: extrasError }, { status: 400 });
  }

  try {
    const saved = await createRestaurant({ ...body, source: "manual" });
    await recordAdminAudit({
      action: "restaurant.create",
      targetType: "restaurant",
      targetId: saved.id,
      summary: `登録: ${body.name}`,
      detail: { status: body.status ?? "draft", geocoded: saved.geocoded },
      actor: adminActor(req),
    });
    return NextResponse.json({ restaurant: saved }, { status: 201 });
  } catch (err) {
    console.error("admin create restaurant failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
