"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RestaurantSearchResult } from "@/lib/restaurants";

type Located = RestaurantSearchResult & { lat: number; lng: number };

// 既定の中心(東京駅周辺)。位置情報のある結果があればそちらに合わせる。
const DEFAULT_CENTER: [number, number] = [35.681, 139.767];

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
}: {
  results: RestaurantSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
            <span className="font-semibold">{r.name}</span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
