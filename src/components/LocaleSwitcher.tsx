"use client";

import { useRouter } from "next/navigation";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  type Locale,
} from "@/lib/i18n";

/**
 * 言語切替。cookie(wm.locale)に保存して router.refresh() でサーバ再描画。
 * サーバ側は getLocale() でこの cookie を読む。
 */
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Locale;
    // 1年保持。匿名前提なのでフラグ程度の cookie。
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Language</span>
      <select
        value={current}
        onChange={onChange}
        aria-label="Language"
        className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-700 outline-none hover:border-orange-400 focus:border-orange-400"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
