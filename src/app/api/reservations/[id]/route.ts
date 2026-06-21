import { NextResponse, type NextRequest } from "next/server";
import { getReservationById } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reservations/:id — 予約状況の参照 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reservation = await getReservationById(id);
  if (!reservation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ reservation });
}
