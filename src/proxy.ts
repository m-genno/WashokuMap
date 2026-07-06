import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// サイト全体の限定公開ゲート(Next 16 の proxy — 旧 middleware)。
// SITE_LOCK=true のときだけ有効。全リクエストにブラウザ標準の Basic 認証を要求し、
// パスワードが ADMIN_TOKEN と一致すれば通す(ユーザー名は任意)。
// ページ側には一切手を入れない。matcher を置かず静的アセットや API も含めて保護する
// (一度認証すればブラウザが以降のリクエストに資格情報を自動付与する)。

// 長さ・内容の比較でタイミング差を作らない定数時間比較。
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// SITE_LOCK の対象外パス。管理画面/管理APIは x-admin-token による独自保護があり、
// Basic 認証を重ねると管理UIの fetch(トークン未入力時の 401)でブラウザの
// 認証ダイアログが毎回出てしまうため除外する。
function isExempt(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/")
  );
}

export function proxy(request: NextRequest) {
  if (process.env.SITE_LOCK !== "true") {
    return NextResponse.next();
  }

  if (isExempt(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    // フラグONなのに合言葉が未設定 → 開けずに閉じ側へ倒す。
    return new NextResponse("Site lock is enabled but ADMIN_TOKEN is not set.", {
      status: 503,
    });
  }

  // cron 等の自動処理(管理APIを x-admin-token で叩く)は Basic 認証を経ずに通す。
  // トークン自体が合言葉なので保護レベルは変わらない。
  const adminHeader = request.headers.get("x-admin-token");
  if (adminHeader !== null && safeEqual(adminHeader, token)) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice("Basic ".length));
      const sep = decoded.indexOf(":");
      const password = sep >= 0 ? decoded.slice(sep + 1) : decoded;
      if (safeEqual(password, token)) {
        return NextResponse.next();
      }
    } catch {
      // base64 が不正なヘッダは未認証として扱う。
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="WashokuMap", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
