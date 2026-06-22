import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  setReservationStatus,
  RESERVATION_STATUSES,
  type ReservationStatusValue,
} from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/reservations/[id]  body: { status, note? }
 * 予約の状態遷移(確定/お断り/完了/No-show/キャンセル等)。監査ログを記録。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !RESERVATION_STATUSES.includes(status as ReservationStatusValue)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    const result = await setReservationStatus(
      id,
      status as ReservationStatusValue,
      { actor: "desk", note: body.note?.trim() || null }
    );
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      // 許可されない遷移。現在の状態も返して画面側を整合させる。
      return NextResponse.json(
        { error: "invalid_transition", from: result.from },
        { status: 409 }
      );
    }
    return NextResponse.json({ reservation: result.reservation });
  } catch (err) {
    console.error("admin set reservation status failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
