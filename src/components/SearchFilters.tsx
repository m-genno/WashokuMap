"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Genre } from "@/lib/genres";

export interface SearchFilterState {
  q?: string;
  genre?: string;
  lat?: string;
  lng?: string;
  radius?: string;
}

/**
 * 検索結果ヘッダ下の絞り込み導線。
 * - ジャンルチップ(選択中はトグルで解除)
 * - 現在地から探すボタン(navigator.geolocation で lat/lng を付与)
 * いずれも現在のクエリ(q など)を保ったまま /search を再読み込みする。
 */
export default function SearchFilters({
  genres,
  current,
}: {
  genres: Genre[];
  current: SearchFilterState;
}) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  const hasGeo = Boolean(current.lat && current.lng);

  function buildUrl(patch: Partial<SearchFilterState>): string {
    const next: SearchFilterState = { ...current, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.genre) params.set("genre", next.genre);
    if (next.lat) params.set("lat", next.lat);
    if (next.lng) params.set("lng", next.lng);
    if (next.radius) params.set("radius", next.radius);
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  function selectGenre(code: string) {
    // 同じジャンルを再度押したら解除。
    router.push(buildUrl({ genre: current.genre === code ? undefined : code }));
  }

  function useCurrentLocation() {
    setLocError("");
    if (!("geolocation" in navigator)) {
      setLocError("この端末では現在地を取得できません。");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        router.push(
          buildUrl({
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6),
            radius: current.radius ?? "3000",
          })
        );
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "位置情報の利用が許可されませんでした。"
            : "現在地を取得できませんでした。"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearLocation() {
    router.push(buildUrl({ lat: undefined, lng: undefined, radius: undefined }));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-2 sm:px-6">
      {/* 現在地の導線 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {hasGeo ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              📍 現在地周辺{current.radius ? `（半径${Math.round(Number(current.radius) / 1000) || 1}km）` : ""}
            </span>
            <button
              type="button"
              onClick={clearLocation}
              className="text-xs text-stone-500 underline hover:text-stone-700"
            >
              現在地を解除
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60"
          >
            📍 {locating ? "現在地を取得中…" : "現在地から探す"}
          </button>
        )}
        {locError && <span className="text-xs text-red-600">{locError}</span>}
      </div>

      {/* ジャンルチップ */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {genres.map((g) => {
          const active = current.genre === g.code;
          const label = g.name_translations.ja ?? g.code;
          return (
            <button
              key={g.code}
              type="button"
              onClick={() => selectGenre(g.code)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-orange-800 bg-orange-800 text-orange-50"
                  : "border-stone-300 bg-white text-stone-700 hover:border-orange-400 hover:text-orange-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
