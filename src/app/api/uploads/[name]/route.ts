import { NextResponse, type NextRequest } from "next/server";
import { readImage } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * GET /api/uploads/[name] — 保存済み画像を配信する。
 * 名前は uploads.ts 側で UUID.ext のみ許可(パストラバーサル防止)。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const img = await readImage(name);
  if (!img) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(img.buffer), {
    status: 200,
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
