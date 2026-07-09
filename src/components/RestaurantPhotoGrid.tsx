"use client";

import { useState } from "react";
import type { RestaurantPhoto } from "@/lib/restaurants";
import PhotoLightbox from "./PhotoLightbox";
import { translator, type Locale } from "@/lib/i18n";

/**
 * 店舗詳細の写真グリッド。サムネ表示し、クリックでライトボックス
 * (同一ウィンドウ内の拡大表示)を開く。
 */
export default function RestaurantPhotoGrid({
  photos,
  name,
  locale,
}: {
  photos: RestaurantPhoto[];
  /** 写真の alt に使う店舗名(表示言語) */
  name: string;
  locale: Locale;
}) {
  const t = translator(locale);
  const [index, setIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p, i) => (
          <button
            type="button"
            key={i}
            aria-label={t("lightbox.open")}
            className="block"
            onClick={() => setIndex(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumb_url ?? p.url}
              alt={p.caption ?? name}
              loading="lazy"
              className="aspect-[4/3] w-full cursor-pointer rounded-xl object-cover hover:opacity-90"
            />
          </button>
        ))}
      </div>
      {index != null && (
        <PhotoLightbox
          photos={photos.map((p) => ({ url: p.url, alt: p.caption ?? name }))}
          index={index}
          locale={locale}
          onClose={() => setIndex(null)}
          onIndexChange={setIndex}
        />
      )}
    </>
  );
}
