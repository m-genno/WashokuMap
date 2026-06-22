import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import RecentSearches from "@/components/RecentSearches";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/serverLocale";
import { translator } from "@/lib/i18n";

export default async function Home() {
  const locale = await getLocale();
  const t = translator(locale);

  const features = [
    { title: t("home.feature1Title"), body: t("home.feature1Body") },
    { title: t("home.feature2Title"), body: t("home.feature2Body") },
    { title: t("home.feature3Title"), body: t("home.feature3Body") },
  ];

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="border-b border-orange-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
            和
          </span>
          <span className="text-lg font-semibold tracking-tight">WashokuMap</span>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher current={locale} />
            <Link
              href="/favorites"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              {t("nav.favorites")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-14">
        <section className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            {t("home.heroTitle")}
          </h1>
          <p className="max-w-xl text-stone-600">{t("home.heroLead")}</p>

          {/* 検索バー(送信時に検索履歴を localStorage に記録) */}
          <div className="mt-2 flex flex-col gap-3">
            <SearchBar size="lg" locale={locale} />
            <RecentSearches locale={locale} />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-1 font-semibold">{f.title}</h2>
              <p className="text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white/70 py-6 text-center text-xs text-stone-500">
        WashokuMap — {t("home.footer")}
      </footer>
    </div>
  );
}
