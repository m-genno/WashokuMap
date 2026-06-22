import type { Metadata } from "next";
import { LOCALES, translate } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * オフライン時のフォールバック。Service Worker が静的にキャッシュするため
 * cookie/JS に依存せず、全言語のメッセージを並べて表示する。
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-orange-50 px-6 text-center text-stone-700">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-800 font-serif text-2xl font-bold text-orange-50">
        和
      </span>
      <h1 className="text-xl font-semibold">Offline</h1>
      <div className="max-w-sm space-y-1 text-sm text-stone-500">
        {LOCALES.map((l) => (
          <p key={l}>{translate(l, "offline.message")}</p>
        ))}
      </div>
    </div>
  );
}
