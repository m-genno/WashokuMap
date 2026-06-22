import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  setRestaurantStatus,
  RESTAURANT_STATUSES,
  type RestaurantStatus,
} from "@/lib/adminRestaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
