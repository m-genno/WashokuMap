/**
 * 住所→緯度経度のジオコーディング。
 * キーレスの Nominatim(OpenStreetMap)を使用。GEOCODE_API_URL で上書き可(モック/プロキシ)。
 * 注意: Nominatim は利用規約上 1req/秒程度。大量投入時は専用ジオコーダ推奨。
 */
export async function geocodeAddress(
  address: string | null | undefined
): Promise<{ lat: number; lng: number } | null> {
  const q = address?.trim();
  if (!q) return null;

  const base =
    process.env.GEOCODE_API_URL ?? "https://nominatim.openstreetmap.org/search";
  const url = `${base}?q=${encodeURIComponent(
    q
  )}&format=json&limit=1&countrycodes=jp`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WashokuMap/0.1 (dev)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.error("[geocode] request error:", err);
    return null;
  }
}
