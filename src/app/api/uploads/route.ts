import { NextResponse, type NextRequest } from "next/server";
import { saveImage, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { getOrCreateUserByAnonymousId } from "@/lib/users";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/uploads  (multipart/form-data: file, anonymousId?)
 * ユーザ画像(口コミ写真)・管理画像(店舗写真)を保存して配信URLを返す。
 * 認可は次のいずれか:
 *   - 管理トークン(x-admin-token)が有効 … 店舗写真の管理アップロード
 *   - 匿名ID … 口コミ写真など、アップロードをユーザに紐付ける(乱用抑止)
 * type(jpeg/png/webp)とサイズ(<=5MB)を検証し、表示用とサムネを生成する。
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  // 管理トークンが無ければ匿名IDでユーザに紐付ける。
  if (!isAdminAuthorized(req)) {
    const anonymousId = String(form.get("anonymousId") ?? "").trim();
    if (!anonymousId) {
      return NextResponse.json(
        { error: "missing_anonymous_id" },
        { status: 400 }
      );
    }
    const userId = await getOrCreateUserByAnonymousId(anonymousId);
    if (!userId) {
      return NextResponse.json(
        { error: "invalid_anonymous_id" },
        { status: 400 }
      );
    }
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await saveImage(buffer);
  if (!result.ok) {
    const status = result.reason === "too_large" ? 413 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(
    { url: result.url, thumbUrl: result.thumbUrl },
    { status: 201 }
  );
}
