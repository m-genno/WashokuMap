import { NextResponse, type NextRequest } from "next/server";
import { setReservationStatus } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reservations/[id]/respond  body: { action: "accept" | "decline" }
 *
 * お客様による代替案(counter_offer)への回答。
 *   accept  → confirmed(代替日時で確定)
 *   decline → cancelled(お客様がキャンセル)
 *
 * 認可: 予約ID(推測困難な UUID)を知っていることを capability とする
 *       (本アプリは登録不要の匿名設計)。expectedFrom='counter_offer' で
 *       代替案待ち以外の状態への誤操作・二重操作を防ぐ。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const toStatus =
    body.action === "accept"
      ? "confirmed"
      : body.action === "decline"
        ? "cancelled"
        : null;
  if (!toStatus) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    const note =
      body.action === "accept"
        ? "お客様が代替案を承諾しました"
        : "お客様が代替案をお断りしました";
    const result = await setReservationStatus(id, toStatus, {
      actor: "guest",
      channel: "web",
      expectedFrom: "counter_offer",
      note,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      // 既に確定/キャンセル済みなど、代替案待ちでない。現在の状態を返す。
      return NextResponse.json(
        { error: "not_pending", from: result.from },
        { status: 409 }
      );
    }

    return NextResponse.json({ status: result.reservation.status });
  } catch (err) {
    console.error("reservation respond failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
