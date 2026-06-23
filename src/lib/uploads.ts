import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { query } from "./db";

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

/** /api/uploads/<name> から保存名を取り出す(不正なら null)。 */
function basenameFromUrl(u: string | null): string | null {
  if (!u) return null;
  const m = /^\/api\/uploads\/([^/?#]+)$/.exec(u);
  return m && NAME_RE.test(m[1]) ? m[1] : null;
}

export interface CleanupReport {
  scanned: number; // 管理対象(UUID.webp等)のファイル総数
  referenced: number; // DBから参照されている保存名の数
  orphans: number; // 削除対象(未参照かつ猶予超過)
  deleted: number; // 実削除数(dryRun時は0)
  freedBytes: number; // 解放(または解放見込み)バイト数
  skippedRecent: number; // 未参照だが新しすぎて保持した数
  dryRun: boolean;
}

/**
 * どの口コミ・店舗にも紐付かない孤立アップロード画像を掃除する。
 * - 参照集合は review_photo / restaurant_photo の url・thumb_url から作る。
 * - 猶予(olderThanHours、既定24h)より新しいファイルは、投稿直前の
 *   アップロード等の可能性があるため保持する。
 * - dryRun=true なら削除せず対象だけ集計する。
 * 管理対象パターン(NAME_RE)に一致しないファイルは一切触らない。
 */
export async function cleanupOrphanUploads(
  opts: { olderThanHours?: number; dryRun?: boolean } = {}
): Promise<CleanupReport> {
  const olderThanHours = Math.max(0, opts.olderThanHours ?? 24);
  const dryRun = opts.dryRun ?? false;
  const dir = uploadDir();

  const rows = await query<{ url: string | null; thumb_url: string | null }>(
    `SELECT url, thumb_url FROM review_photo
     UNION ALL
     SELECT url, thumb_url FROM restaurant_photo`
  );
  const referenced = new Set<string>();
  for (const r of rows) {
    const a = basenameFromUrl(r.url);
    if (a) referenced.add(a);
    const b = basenameFromUrl(r.thumb_url);
    if (b) referenced.add(b);
  }

  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    files = []; // ディレクトリ未作成 = 何もない
  }

  const cutoff = Date.now() - olderThanHours * 3_600_000;
  let scanned = 0;
  let orphans = 0;
  let deleted = 0;
  let freedBytes = 0;
  let skippedRecent = 0;

  for (const name of files) {
    if (!NAME_RE.test(name)) continue; // 管理対象外は触らない
    scanned++;
    if (referenced.has(name)) continue;

    let st;
    try {
      st = await stat(path.join(dir, name));
    } catch {
      continue;
    }
    if (st.mtimeMs > cutoff) {
      skippedRecent++;
      continue;
    }

    orphans++;
    freedBytes += st.size;
    if (!dryRun) {
      try {
        await unlink(path.join(dir, name));
        deleted++;
      } catch (err) {
        console.error("[uploads] unlink failed:", name, err);
        freedBytes -= st.size; // 失敗分は戻す
      }
    }
  }

  return {
    scanned,
    referenced: referenced.size,
    orphans,
    deleted,
    freedBytes,
    skippedRecent,
    dryRun,
  };
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
