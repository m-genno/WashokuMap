"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import type { StyleSpecification } from "maplibre-gl";
import type { RestaurantSearchResult } from "@/lib/restaurants";
import { pickTranslation, type Locale } from "@/lib/i18n";

type Located = RestaurantSearchResult & { lat: number; lng: number };

// 既定の中心(東京駅周辺)。位置情報のある結果があればそちらに合わせる。
const DEFAULT_CENTER: [number, number] = [35.681, 139.767];

// OpenFreeMap のベクタータイル(無料・無制限・キー不要)。https://openfreemap.org/
const STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// OpenFreeMap が落ちている場合のフォールバック(従来のラスタータイル)
const FALLBACK_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** ロケールごとのラベル参照キー(OSM の name:* タグ)。先頭から順に採用し、無ければ name。
 *  zh は漢字(name=日本語)がある程度読めるため日本語へ、ko はローマ字へフォールバックする。 */
const LABEL_KEYS: Record<Locale, string[]> = {
  ja: ["name:ja"],
  en: ["name:en", "name:latin"],
  "zh-Hans": ["name:zh-Hans", "name:zh"],
  "zh-Hant": ["name:zh-Hant", "name:zh"],
  ko: ["name:ko", "name:latin"],
};

let baseStylePromise: Promise<StyleSpecification> | null = null;

/** スタイルJSONを1回だけ取得して使い回す(失敗時は次回再取得)。 */
function fetchBaseStyle(): Promise<StyleSpecification> {
  baseStylePromise ??= fetch(STYLE_URL).then((res) => {
    if (!res.ok) throw new Error(`style fetch failed: ${res.status}`);
    return res.json() as Promise<StyleSpecification>;
  });
  return baseStylePromise.catch((e) => {
    baseStylePromise = null;
    throw e;
  });
}

/** 地名ラベルの text-field をロケールに応じた name:* 参照に差し替える。 */
function localizeStyle(
  style: StyleSpecification,
  locale: Locale
): StyleSpecification {
  const textField = [
    "coalesce",
    ...LABEL_KEYS[locale].map((key) => ["get", key]),
    ["get", "name"],
  ];
  const layers = style.layers.map((layer) => {
    if (layer.type !== "symbol" || !layer.layout) return layer;
    const current = layer.layout["text-field"];
    // 道路番号 {ref} などはそのまま。地名(name 参照)だけ差し替える。
    if (!current || !JSON.stringify(current).includes("name")) return layer;
    return {
      ...layer,
      layout: { ...layer.layout, "text-field": textField },
    } as typeof layer;
  });
  return { ...style, layers };
}

/** OpenFreeMap のベクタータイルをロケール別ラベルで表示する背景レイヤー。 */
function VectorBaseLayer({ locale }: { locale: Locale }) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    let layer: L.Layer | null = null;

    fetchBaseStyle()
      .then((base) => {
        if (cancelled) return;
        layer = L.maplibreGL({
          style: localizeStyle(base, locale),
          attributionControl: { customAttribution: ATTRIBUTION },
        }).addTo(map);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(
          "RestaurantMap: ベクタータイルを読み込めないためラスターにフォールバックします",
          err
        );
        layer = L.tileLayer(FALLBACK_TILE_URL, {
          attribution: FALLBACK_ATTRIBUTION,
        }).addTo(map);
      });

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, locale]);

  return null;
}

/** 画像アセット不要の divIcon ピン(ブランド色)。選択中は大きく・色を変える。 */
function pinIcon(selected: boolean): L.DivIcon {
  const size = selected ? 34 : 26;
  const color = selected ? "#b45309" : "#9a3412"; // amber-700 / orange-800
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);border:2px solid #fff7ed;
      box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

/** マウント時/結果変更時に全マーカーが収まるよう表示範囲を合わせる。 */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/** 選択中の店舗へパンする。 */
function PanToSelected({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) {
      map.flyTo(point, Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [map, point]);
  return null;
}

export default function RestaurantMap({
  results,
  selectedId,
  onSelect,
  locale = "ja",
}: {
  results: RestaurantSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  locale?: Locale;
}) {
  const located = useMemo(
    () =>
      results.filter(
        (r): r is Located => r.lat != null && r.lng != null
      ),
    [results]
  );
  const points = useMemo(
    () => located.map((r) => [r.lat, r.lng] as [number, number]),
    [located]
  );

  const selected = located.find((r) => r.id === selectedId) ?? null;

  return (
    <MapContainer
      center={points[0] ?? DEFAULT_CENTER}
      zoom={13}
      maxZoom={19}
      scrollWheelZoom
      className="h-full w-full"
    >
      <VectorBaseLayer locale={locale} />
      <FitBounds points={points} />
      <PanToSelected point={selected ? [selected.lat, selected.lng] : null} />
      {located.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={pinIcon(r.id === selectedId)}
          eventHandlers={{ click: () => onSelect(r.id) }}
        >
          <Popup>
            <span className="font-semibold">
              {pickTranslation(r.name_translations, locale, r.name)}
            </span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
