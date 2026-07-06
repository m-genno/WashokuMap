import net from "node:net";
import { type NextRequest } from "next/server";

/**
 * クライアントIPの解決。
 *
 * X-Forwarded-For はクライアントが自由に送れるため、そのまま信じると
 * レート制限のバイパスや監査ログのIP偽装ができてしまう。
 * 前段の信頼できるリバースプロキシ(Render/Vercel/nginx 等)を
 * TRUSTED_PROXY_IPS(カンマ区切りの IP または CIDR)で申告してもらい、
 * XFF を右(直近のホップ)から辿って「信頼プロキシ以外の最初のIP」を採用する。
 * ※ 信頼できるプロキシは自分が見たピアIPを XFF に追記する、という前提。
 *
 * TRUSTED_PROXY_IPS が未設定なら XFF/x-real-ip は一切信頼せず null を返す
 * (fail-closed: レート制限は全クライアント共有のバケットになり、緩くはならない)。
 */

let cached: { raw: string | undefined; list: net.BlockList | null } | null =
  null;
let warned = false;

/** IPv4射影(::ffff:a.b.c.d)や [v6] の角括弧・v4 の :port を素のIPへ正規化。 */
function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (ip.startsWith("[")) ip = ip.replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.indexOf(":"));
  return ip;
}

/** TRUSTED_PROXY_IPS をパースして BlockList を作る(env 変更がなければキャッシュ)。 */
function trustedProxies(): net.BlockList | null {
  const raw = process.env.TRUSTED_PROXY_IPS;
  if (cached && cached.raw === raw) return cached.list;

  let list: net.BlockList | null = null;
  const entries = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length > 0) {
    list = new net.BlockList();
    for (const entry of entries) {
      const [addr, prefix] = entry.split("/");
      const ip = normalizeIp(addr);
      const family = net.isIP(ip);
      if (family === 0) {
        console.warn(`[clientIp] TRUSTED_PROXY_IPS の不正なエントリを無視: ${entry}`);
        continue;
      }
      const type = family === 4 ? "ipv4" : "ipv6";
      if (prefix !== undefined) {
        const n = Number(prefix);
        const max = family === 4 ? 32 : 128;
        if (!Number.isInteger(n) || n < 0 || n > max) {
          console.warn(`[clientIp] TRUSTED_PROXY_IPS の不正なCIDRを無視: ${entry}`);
          continue;
        }
        list.addSubnet(ip, n, type);
      } else {
        list.addAddress(ip, type);
      }
    }
  }
  cached = { raw, list };
  return list;
}

function isTrusted(ip: string, list: net.BlockList): boolean {
  const family = net.isIP(ip);
  if (family === 0) return false;
  return list.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/**
 * クライアントIP。信頼できる形で特定できないときは null。
 * TRUSTED_PROXY_IPS 未設定時は常に null(XFF は偽装可能なので使わない)。
 */
export function clientIp(req: NextRequest): string | null {
  const trusted = trustedProxies();
  if (!trusted) {
    if (!warned) {
      warned = true;
      console.warn(
        "[clientIp] TRUSTED_PROXY_IPS is not set; X-Forwarded-For is ignored. " +
          "Rate limits fall back to a single shared bucket and audit logs omit IPs. " +
          "Set it to your reverse proxy's IP/CIDR list in production."
      );
    }
    return null;
  }

  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => normalizeIp(s))
    .filter(Boolean);
  // 右端=直近のホップが見たピア。信頼プロキシを飛ばし、最初の外部IPを採用。
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isTrusted(chain[i], trusted)) return chain[i];
  }
  // 全ホップが信頼プロキシ(プロキシ自身からのアクセス等)は x-real-ip にフォールバック。
  const realIp = req.headers.get("x-real-ip");
  return realIp ? normalizeIp(realIp) : null;
}
