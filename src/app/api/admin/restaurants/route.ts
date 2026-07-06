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
 * GET /api/admin/restaurants?status=draft|published|closed|all&q=...&page=1&perPage=50
 * 管理用の店舗一覧(下書き含む)。status 省略時は draft、q で語句検索。
 * page は1始まり。total で総件数を返す。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const raw = sp.get("status") ?? "draft";
  let status: RestaurantStatus | null;
  if (raw === "all") {
    status = null;
  } else if (RESTAURANT_STATUSES.includes(raw as RestaurantStatus)) {
    status = raw as RestaurantStatus;
  } else {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const q = sp.get("q");
  const batch = sp.get("batch");
  const pageRaw = Number(sp.get("page"));
  const perPageRaw = Number(sp.get("perPage"));
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const perPage =
    Number.isFinite(perPageRaw) && perPageRaw >= 1
      ? Math.min(Math.floor(perPageRaw), 500)
      : 50;

  try {
    const { restaurants, total } = await listRestaurantsForAdmin({
      status,
      q,
      importBatchId: batch,
      limit: perPage,
      offset: (page - 1) * perPage,
    });
    return NextResponse.json({
      count: restaurants.length,
      total,
      page,
      perPage,
      restaurants,
    });
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
    // 登録内容も差分形式(from: なし)で記録し、詳細画面で項目ごとに確認できるようにする。
    const initialFields: [string, unknown][] = [
      ["name", body.name],
      ["name_en", body.nameEn],
      ["description", body.description],
      ["address", body.address],
      ["phone", body.phone],
      ["website_url", body.websiteUrl],
      ["reservation_mode", body.reservationMode],
      ["reservation_url", body.reservationUrl],
      ["price_range", body.priceRange],
      ["status", body.status ?? "draft"],
      ["genres", body.genres?.length ? body.genres : null],
      ["photos", body.photos?.length || null],
      ["hours", body.hours?.length || null],
    ];
    const changes: Record<string, { from: null; to: unknown }> = {};
    for (const [k, v] of initialFields) {
      if (v != null && v !== "") changes[k] = { from: null, to: v };
    }
    await recordAdminAudit({
      action: "restaurant.create",
      targetType: "restaurant",
      targetId: saved.id,
      summary: `登録: ${body.name}`,
      detail: { status: body.status ?? "draft", geocoded: saved.geocoded, changes },
      actor: adminActor(req),
    });
    return NextResponse.json({ restaurant: saved }, { status: 201 });
  } catch (err) {
    console.error("admin create restaurant failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
