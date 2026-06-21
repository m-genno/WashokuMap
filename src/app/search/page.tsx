import Link from "next/link";
import { searchRestaurants } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  genre?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const lat = sp.lat ? Number(sp.lat) : undefined;
  const lng = sp.lng ? Number(sp.lng) : undefined;

  const results = await searchRestaurants({
    q,
    lat,
    lng,
    radiusM: sp.radius ? Number(sp.radius) : undefined,
    genre: sp.genre,
  });

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="border-b border-orange-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="text-lg font-semibold tracking-tight">
              WashokuMap
            </span>
          </Link>
          <form action="/search" className="ml-auto flex flex-1 gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="店名・ジャンル・エリアで検索"
              aria-label="和食店を検索"
              className="flex-1 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="submit"
              className="rounded-full bg-orange-800 px-4 py-2 text-sm font-medium text-orange-50 hover:bg-orange-900"
            >
              検索
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <p className="mb-4 text-sm text-stone-500">
          {q ? <>「{q}」の検索結果: </> : "検索結果: "}
          {results.length} 件
        </p>

        {results.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
            該当する和食店が見つかりませんでした。別のキーワードでお試しください。
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {results.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{r.name}</h2>
                  {r.rating_count > 0 && (
                    <span className="shrink-0 text-sm text-amber-600">
                      ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
                    </span>
                  )}
                </div>
                {r.name_translations?.en && (
                  <p className="text-sm text-stone-500">
                    {r.name_translations.en}
                  </p>
                )}
                {r.address && (
                  <p className="mt-1 text-sm text-stone-600">{r.address}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {r.price_range && <span>{"¥".repeat(r.price_range)}</span>}
                  <span>予約: {r.reservation_mode}</span>
                  {r.distance_m != null && (
                    <span>{Math.round(r.distance_m)} m</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
