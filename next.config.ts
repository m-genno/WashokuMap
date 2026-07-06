import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP: 外部に依存するのは地図タイル(OpenStreetMap)の画像のみ。
// - script/style の 'unsafe-inline' は Next のブートストラップスクリプトと
//   Leaflet divIcon の style 属性に必要(nonce 化する場合は middleware 導入を検討)。
// - dev のみ HMR(Turbopack)用に 'unsafe-eval' と WebSocket を許可。
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // frame-ancestors の旧ブラウザ向けフォールバック(管理画面のクリックジャッキング対策)。
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
