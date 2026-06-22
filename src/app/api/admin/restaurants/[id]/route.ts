import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  setRestaurantStatus,
  getRestaurantForAdmin,
  updateRestaurant,
  RESTAURANT_STATUSES,
  type RestaurantStatus,
  type RestaurantInput,
} from "@/lib/adminRestaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = ["request", "external", "phone_only"];

/**
 * GET /api/admin/restaurants/[id]
 * 編集フォーム用に単一店舗(下書き含む)を返す。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const restaurant = await getRestaurantForAdmin(id);
    if (!restaurant) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ restaurant });
  } catch (err) {
    console.error("admin get restaurant failed:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/restaurants/[id] — 店舗の編集(全項目更新)。
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

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
  if (
    body.status &&
    !RESTAURANT_STATUSES.includes(body.status as RestaurantStatus)
  ) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const result = await updateRestaurant(id, body);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "no_location_for_publish" },
        { status: 400 }
      );
    }
    return NextResponse.json({ restaurant: result.restaurant });
  } catch (err) {
    console.error("admin update restaurant failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/restaurants/[id]  body: { status: 'draft'|'published'|'closed' }
 * 店舗のステータスを変更(公開/下書きに戻す/休止)。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !RESTAURANT_STATUSES.includes(status as RestaurantStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const updated = await setRestaurantStatus(id, status as RestaurantStatus);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ restaurant: updated });
  } catch (err) {
    console.error("admin set status failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
