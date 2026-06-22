import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import {
  setReservationStatus,
  RESERVATION_STATUSES,
  type ReservationStatusValue,
} from "@/lib/reservations";
import {
  isGuestNotifyStatus,
  sendGuestReservationNotification,
  recordGuestNotificationEvent,
} from "@/lib/guestNotifications";
import { recordAdminAudit, adminActor } from "@/lib/adminAudit";

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

    await recordAdminAudit({
      action: "reservation.status",
      targetType: "reservation",
      targetId: result.reservation.id,
      summary: `予約: ${result.reservation.from_status} → ${result.reservation.status}`,
      detail: {
        from: result.reservation.from_status,
        to: result.reservation.status,
      },
      actor: adminActor(req),
    });

    // 可否が決まる遷移(確定/お断り/代替提案/キャンセル)はお客様へ通知する。
    // 通知失敗で状態変更が無効にならないよう保護する。
    let notified = false;
    if (isGuestNotifyStatus(result.reservation.status)) {
      try {
        const sendResult = await sendGuestReservationNotification(
          { id: result.reservation.id, ...result.detail },
          result.reservation.status
        );
        await recordGuestNotificationEvent(
          result.reservation.id,
          result.reservation.status,
          sendResult
        );
        notified = sendResult.delivered;
      } catch (notifyErr) {
        console.error("guest notification failed:", notifyErr);
      }
    }

    return NextResponse.json({ reservation: result.reservation, notified });
  } catch (err) {
    console.error("admin set reservation status failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
