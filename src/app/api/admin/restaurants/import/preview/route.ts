import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { previewImport } from "@/lib/adminRestaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 1000;

interface PreviewBody {
  rows?: Record<string, string>[];
}

/**
 * POST /api/admin/restaurants/import/preview
 * CSVパース済みの行を取込前にドライラン判定(新規/更新/失敗)。書き込みなし。
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PreviewBody;
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
    const preview = await previewImport(body.rows);
    return NextResponse.json({ preview });
  } catch (err) {
    console.error("admin import preview failed:", err);
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}
