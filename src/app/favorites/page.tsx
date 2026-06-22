import Link from "next/link";
import FavoritesList from "@/components/FavoritesList";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/serverLocale";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="text-lg font-semibold tracking-tight">
              WashokuMap
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher current={locale} />
            <Link
              href="/search"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              {t("nav.search")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold">{t("fav.title")}</h1>
        <FavoritesList locale={locale} />
      </main>
    </div>
  );
}
