import Link from "next/link";
import { searchRestaurants } from "@/lib/restaurants";
import SearchResultsView from "@/components/SearchResultsView";
import SearchBar from "@/components/SearchBar";

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

  const results = await searchRestaurants({
    q,
    lat: sp.lat ? Number(sp.lat) : undefined,
    lng: sp.lng ? Number(sp.lng) : undefined,
    radiusM: sp.radius ? Number(sp.radius) : undefined,
    genre: sp.genre,
  });

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="sticky top-0 z-[1000] border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">
              WashokuMap
            </span>
          </Link>
          <div className="ml-auto flex flex-1 items-center gap-3">
            <SearchBar size="sm" defaultValue={q} />
            <Link
              href="/favorites"
              className="hidden shrink-0 text-sm text-stone-500 hover:text-stone-800 sm:inline"
            >
              ♥
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-2 text-xs text-stone-500 sm:px-6">
          {q ? <>「{q}」の検索結果: </> : "検索結果: "}
          {results.length} 件
        </p>
      </header>

      <main className="flex-1">
        <SearchResultsView results={results} />
      </main>
    </div>
  );
}
