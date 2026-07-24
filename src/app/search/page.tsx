import Link from "next/link";
import { searchRestaurants } from "@/lib/restaurants";
import { listGenres } from "@/lib/genres";
import SearchResultsView from "@/components/SearchResultsView";
import SearchBar from "@/components/SearchBar";
import SearchFilters from "@/components/SearchFilters";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/serverLocale";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** 検索結果の1ページ件数(地図マーカーもこの件数と連動)。 */
const PER_PAGE = 20;

type SearchParams = {
  q?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  genre?: string;
  page?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const locale = await getLocale();
  const t = translator(locale);

  const pageRaw = Number(sp.page);
  let page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const searchOpts = {
    q,
    lat: sp.lat ? Number(sp.lat) : undefined,
    lng: sp.lng ? Number(sp.lng) : undefined,
    radiusM: sp.radius ? Number(sp.radius) : undefined,
    genre: sp.genre,
    limit: PER_PAGE,
  };

  const genresPromise = listGenres();
  let { results, total } = await searchRestaurants({
    ...searchOpts,
    offset: (page - 1) * PER_PAGE,
  });

  // 古いURL等でページが範囲外なら最終ページに寄せて取り直す。
  if (results.length === 0 && total > 0 && page > 1) {
    page = Math.max(1, Math.ceil(total / PER_PAGE));
    ({ results, total } = await searchRestaurants({
      ...searchOpts,
      offset: (page - 1) * PER_PAGE,
    }));
  }
  const genres = await genresPromise;

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
          <div className="ml-auto flex min-w-0 flex-1 items-center gap-3">
            <SearchBar size="sm" defaultValue={q} locale={locale} />
            <LocaleSwitcher current={locale} />
            <Link
              href="/favorites"
              className="hidden shrink-0 text-sm text-stone-500 hover:text-stone-800 sm:inline"
            >
              ♥
            </Link>
            <Link
              href="/reservations"
              className="hidden shrink-0 text-sm text-stone-500 hover:text-stone-800 sm:inline"
            >
              {t("nav.reservations")}
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-2 text-xs text-stone-500 sm:px-6">
          {q ? t("search.headingWithQuery", { q }) : t("search.heading")}
          {t("search.count", { count: total })}
        </p>
        <SearchFilters
          locale={locale}
          genres={genres}
          current={{
            q: sp.q,
            genre: sp.genre,
            lat: sp.lat,
            lng: sp.lng,
            radius: sp.radius,
          }}
        />
      </header>

      <main className="flex-1">
        <SearchResultsView
          results={results}
          locale={locale}
          page={page}
          perPage={PER_PAGE}
          total={total}
          searchState={{
            q: sp.q,
            genre: sp.genre,
            lat: sp.lat,
            lng: sp.lng,
            radius: sp.radius,
          }}
        />
      </main>
    </div>
  );
}
