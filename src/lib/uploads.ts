import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * 画像アップロードのローカル保存(軽量化・サムネ生成つき)。
 *
 * 外部ストレージ(S3等)を増やさず、ローカルファイルシステムに保存して
 * /api/uploads/<name> で配信する。保存先は UPLOAD_DIR(既定: ./uploads)。
 *
 * アップロード時に sharp で2サイズを生成する:
 *   - 表示用 url:    最大 1600px / WebP q80(EXIF 回転を反映、メタデータ除去)
 *   - サムネ thumbUrl: 最大 400px  / WebP q70
 * これによりスマホの数MB写真も数十〜百数十KBに軽量化される。
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB(入力上限)

const FULL_MAX = 1600;
const THUMB_MAX = 400;

/** 配信URL名の検証(パストラバーサル防止)。UUID(.t).webp 等のみ許可。 */
const NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-t)?\.(webp|jpg|png)$/;

const EXT_MIME: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

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
  | { ok: true; url: string; thumbUrl: string }
  | { ok: false; reason: "unsupported_type" | "too_large" | "write_failed" };

/**
 * 画像を軽量化・サムネ生成して保存し、表示用URLとサムネURLを返す。
 * デコードできない入力(画像でない等)は unsupported_type。
 */
export async function saveImage(buffer: Buffer): Promise<SaveResult> {
  if (buffer.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  let full: Buffer;
  let thumb: Buffer;
  try {
    // rotate() で EXIF の向きを反映。clone で同一入力から2サイズを生成。
    const base = sharp(buffer, { failOn: "error" }).rotate();
    full = await base
      .clone()
      .resize({ width: FULL_MAX, height: FULL_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    thumb = await base
      .clone()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
  } catch (err) {
    console.error("[uploads] decode/resize failed:", err);
    return { ok: false, reason: "unsupported_type" };
  }

  const id = randomUUID();
  const fullName = `${id}.webp`;
  const thumbName = `${id}-t.webp`;
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fullName), full);
    await writeFile(path.join(dir, thumbName), thumb);
    return {
      ok: true,
      url: `/api/uploads/${fullName}`,
      thumbUrl: `/api/uploads/${thumbName}`,
    };
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
