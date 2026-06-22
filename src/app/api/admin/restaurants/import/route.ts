import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { importRestaurants } from "@/lib/adminRestaurants";
import { recordAdminAudit, adminActor } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 1000;

interface ImportBody {
  filename?: string;
  rows?: Record<string, string>[];
}

/** POST /api/admin/restaurants/import — CSVパース済みの行を一括投入 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "no_rows" }, { status: 400 });
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: "too_many_rows", max: MAX_ROWS },
      { status: 400 }
    );
  }

  try {
    const result = await importRestaurants(
      body.rows,
      body.filename ?? "upload.csv"
    );
    await recordAdminAudit({
      action: "restaurant.import",
      targetType: "import",
      targetId: result.batchId,
      summary: `CSV取込: ${body.filename ?? "upload.csv"} (+${result.inserted}/更新${result.updated}/失敗${result.failed})`,
      detail: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed,
      },
      actor: adminActor(req),
    });
    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    console.error("admin import failed:", err);
    return NextResponse.json({ error: "import_failed" }, { status: 500 });
  }
}
