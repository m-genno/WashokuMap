"use client";

import { useEffect } from "react";

/**
 * Service Worker を本番環境でのみ登録するクライアントコンポーネント。
 * 開発時(next dev)はキャッシュの混乱を避けるため登録しない。
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
