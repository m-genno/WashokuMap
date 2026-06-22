import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 画像アップロードのローカル保存。
 *
 * 外部ストレージ(S3等)を増やさず、ローカルファイルシステムに保存して
 * /api/uploads/<name> で配信する。保存先は UPLOAD_DIR(既定: ./uploads)。
 * 単一サーバ向けの簡易実装。サーバレス/水平分割では将来オブジェクトストレージへ。
 */

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

/** 配信URL名の検証(パストラバーサル防止)。例: 1f...e.jpg */
const NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** /api/uploads/<name> 形式のURLか(口コミに保存してよいURLか)。 */
export function isUploadUrl(url: string): boolean {
  const m = /^\/api\/uploads\/([^/?#]+)$/.exec(url);
  return !!m && NAME_RE.test(m[1]);
}

function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
}

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unsupported_type" | "too_large" | "write_failed" };

/** 画像を保存して配信URLを返す。type/サイズを検証。 */
export async function saveImage(
  buffer: Buffer,
  mime: string
): Promise<SaveResult> {
  const ext = MIME_EXT[mime];
  if (!ext) return { ok: false, reason: "unsupported_type" };
  if (buffer.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const name = `${randomUUID()}.${ext}`;
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
    return { ok: true, url: `/api/uploads/${name}` };
  } catch (err) {
    console.error("[uploads] write failed:", err);
    return { ok: false, reason: "write_failed" };
  }
}

/** 配信用に画像を読み出す。名前が不正・未存在なら null。 */
export async function readImage(
  name: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!NAME_RE.test(name)) return null; // トラバーサル/不正名を拒否
  const ext = name.split(".").pop() as string;
  try {
    const buffer = await readFile(path.join(uploadDir(), name));
    return { buffer, mime: EXT_MIME[ext] };
  } catch {
    return null;
  }
}
