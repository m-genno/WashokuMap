"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/clientStore";
import { translator, type Locale } from "@/lib/i18n";

/** お気に入り(localStorage)の一覧。表示文言は locale で切替。 */
export default function FavoritesList({ locale = "ja" }: { locale?: Locale }) {
  const { items, remove } = useFavorites();
  const t = translator(locale);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
        {t("fav.empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => {
        // 非日本語UIでは英語名を主表示にし、日本語の原名を副題に。
        const primary = locale !== "ja" && f.nameEn ? f.nameEn : f.name;
        const secondary = primary !== f.name ? f.name : null;
        return (
          <li
            key={f.id}
            className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
          >
            <Link href={`/restaurants/${f.id}`} className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{primary}</h2>
              {secondary && (
                <p className="truncate text-sm text-stone-500">{secondary}</p>
              )}
              {f.address && (
                <p className="truncate text-sm text-stone-600">{f.address}</p>
              )}
            </Link>
            <button
              type="button"
              onClick={() => remove(f.id)}
              className="shrink-0 rounded-full border border-orange-200 px-3 py-1 text-xs text-stone-600 hover:border-rose-300 hover:text-rose-600"
            >
              {t("fav.remove")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
