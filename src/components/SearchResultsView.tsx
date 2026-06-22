"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { RestaurantSearchResult } from "@/lib/restaurants";
import FavoriteButton from "./FavoriteButton";
import { translator, pickTranslation, type Locale } from "@/lib/i18n";

// Leaflet は window 依存のためクライアントのみで読み込む。
const RestaurantMap = dynamic(() => import("./RestaurantMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-orange-100 text-sm text-stone-500">
      地図を読み込み中…
    </div>
  ),
});

export default function SearchResultsView({
  results,
  locale = "ja",
}: {
  results: RestaurantSearchResult[];
  locale?: Locale;
}) {
  const t = translator(locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // マーカー選択時、一覧の該当項目を見える位置へスクロール。
  useEffect(() => {
    if (selectedId && itemRefs.current[selectedId]) {
      itemRefs.current[selectedId]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedId]);

  if (results.length === 0) {
    return (
      <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
        {t("results.empty")}
      </p>
    );
  }

  return (
    <div className="md:grid md:grid-cols-2">
      {/* 地図: モバイルは上部固定高、デスクトップは画面追従 */}
      <div className="h-64 md:sticky md:top-0 md:h-[calc(100vh-65px)]">
        <RestaurantMap
          results={results}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* 一覧 */}
      <ul className="flex flex-col gap-3 p-4">
        {results.map((r) => {
          const selected = r.id === selectedId;
          const displayName = pickTranslation(r.name_translations, locale, r.name);
          return (
            <li
              key={r.id}
              ref={(el) => {
                itemRefs.current[r.id] = el;
              }}
              className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                selected
                  ? "border-amber-500 ring-2 ring-amber-300"
                  : "border-orange-100 hover:border-orange-300"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="w-full p-4 pb-2 text-left"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{displayName}</h2>
                  {r.rating_count > 0 && (
                    <span className="shrink-0 text-sm text-amber-600">
                      ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
                    </span>
                  )}
                </div>
                {displayName !== r.name && (
                  <p className="text-sm text-stone-500">{r.name}</p>
                )}
                {r.address && (
                  <p className="mt-1 text-sm text-stone-600">{r.address}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {r.price_range && <span>{"¥".repeat(r.price_range)}</span>}
                  <span>
                    {t("results.reservationLabel")}: {t(`resv.${r.reservation_mode}`)}
                  </span>
                  {r.distance_m != null && (
                    <span>{Math.round(r.distance_m)} m</span>
                  )}
                </div>
              </button>
              <div className="flex items-center justify-between px-4 pb-3">
                <Link
                  href={`/restaurants/${r.id}`}
                  className="text-sm font-medium text-orange-800 hover:text-orange-900"
                >
                  {t("results.detail")}
                </Link>
                <FavoriteButton
                  item={{
                    id: r.id,
                    name: r.name,
                    nameEn: r.name_translations?.en,
                    address: r.address,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
