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
 * GET /api/admin/reservations?status=...&q=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * 予約デスク向けの予約一覧。status 省略時は requested(要対応)。
 * q はお客様名/店名/メール/電話、from/to は希望日時の範囲で絞り込む。
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const raw = sp.get("status") ?? "requested";
  let status: ReservationStatusValue | null;
  if (raw === "all") {
    status = null;
  } else if (RESERVATION_STATUSES.includes(raw as ReservationStatusValue)) {
    status = raw as ReservationStatusValue;
  } else {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const reservations = await listReservationsForAdmin({
      status,
      q: sp.get("q"),
      from: sp.get("from"),
      to: sp.get("to"),
    });
    return NextResponse.json({ count: reservations.length, reservations });
  } catch (err) {
    console.error("admin list reservations failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
