// WashokuMap Service Worker (MVP)
// 目的: PWAの最低要件を満たし、オフライン時にフォールバックを返す。
// 本格的なキャッシュ戦略(店舗データ等)は将来 Workbox 等で拡張する。

const CACHE_VERSION = "washokumap-v1";
const APP_SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// ナビゲーション要求はネットワーク優先、失敗時はオフラインページへ。
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/offline"))
      )
    );
    return;
  }
});
