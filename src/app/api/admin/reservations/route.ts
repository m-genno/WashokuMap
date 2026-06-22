import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  listReservationsForAdmin,
  RESERVATION_STATUSES,
  type ReservationStatusValue,
} from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reservations?status=requested|confirmed|...|all
 * 予約デスク向けの予約一覧。status 省略時は requested(要対応)。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("status") ?? "requested";
  let status: ReservationStatusValue | null;
  if (raw === "all") {
    status = null;
  } else if (RESERVATION_STATUSES.includes(raw as ReservationStatusValue)) {
    status = raw as ReservationStatusValue;
  } else {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const reservations = await listReservationsForAdmin({ status });
    return NextResponse.json({ count: reservations.length, reservations });
  } catch (err) {
    console.error("admin list reservations failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
