import { NextResponse, type NextRequest } from "next/server";

/**
 * 公開APIの簡易レート制限と入力サイズガード。
 *
 * 依存を増やさないインメモリ固定ウィンドウ実装。**単一ノード向け**。
 * 水平分割(サーバレス/多ノード)では各インスタンスごとの best-effort になるため、
 * 本格運用では Redis / Upstash 等の共有ストアに置き換えること。
 * `RATE_LIMIT_DISABLED=true` で無効化(テスト用)。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

/** クライアントIP(プロキシ経由の最初のホップ)。取得不能時は 'unknown'。 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateOptions {
  /** ウィンドウ内の最大リクエスト数 */
  limit: number;
  /** ウィンドウ長(ミリ秒) */
  windowMs: number;
}

/**
 * IP(+任意の補助キー)単位のレート制限。
 * 超過時は 429(Retry-After つき)の NextResponse、許容時は null を返す。
 */
export function enforceRateLimit(
  req: NextRequest,
  name: string,
  opts: RateOptions,
  keyExtra?: string
): NextResponse | null {
  if (process.env.RATE_LIMIT_DISABLED === "true") return null;

  const now = Date.now();
  sweep(now);

  const ip = clientIp(req);
  const key = `${name}:${ip}${keyExtra ? `:${keyExtra}` : ""}`;
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, b);
  }
  b.count++;

  if (b.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}

/** Content-Length が上限を超えていれば true(本文を読む前の早期拒否用)。 */
export function requestTooLarge(req: NextRequest, maxBytes: number): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > maxBytes;
}

/** 文字列を最大長で切り詰める(null/undefined はそのまま)。入力長の保険。 */
export function clampLen<T extends string | null | undefined>(
  s: T,
  max: number
): T {
  if (typeof s === "string" && s.length > max) return s.slice(0, max) as T;
  return s;
}

/** よく使うサイズ上限。 */
export const MAX_JSON_BYTES = 16 * 1024; // 16KB(JSON API の本文上限)
export const MAX_UPLOAD_REQUEST_BYTES = 6 * 1024 * 1024; // 5MB画像 + multipart余白
