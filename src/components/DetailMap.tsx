"use client";

import dynamic from "next/dynamic";
import type { RestaurantSearchResult } from "@/lib/restaurants";
import MapLoading from "./MapLoading";

const RestaurantMap = dynamic(() => import("./RestaurantMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

/** 1店舗だけを表示する地図(詳細ページ用)。RestaurantMap を流用。 */
export default function DetailMap({
  id,
  name,
  lat,
  lng,
}: {
  id: string;
  name: string;
  lat: number;
  lng: number;
}) {
  const point: RestaurantSearchResult = {
    id,
    name,
    name_translations: {},
    address: null,
    lat,
    lng,
    rating_avg: 0,
    rating_count: 0,
    price_range: null,
    reservation_mode: "request",
    primary_photo_url: null,
    distance_m: null,
  };

  return (
    <RestaurantMap results={[point]} selectedId={id} onSelect={() => {}} />
  );
}
