"use client";

import { useRouter } from "next/navigation";
import { addHistory } from "@/lib/clientStore";
import { translator, type Locale } from "@/lib/i18n";

/** 検索バー。送信時に検索履歴(localStorage)へ記録してから /search へ遷移。 */
export default function SearchBar({
  defaultValue = "",
  size = "lg",
  locale = "ja",
}: {
  defaultValue?: string;
  size?: "lg" | "sm";
  locale?: Locale;
}) {
  const router = useRouter();
  const t = translator(locale);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q =
      new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
    if (q) addHistory(q);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const pad = size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm";
  const btnPad = size === "lg" ? "px-6 py-3" : "px-4 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="flex flex-1 gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={t("searchBar.placeholder")}
        aria-label={t("searchBar.aria")}
        className={`flex-1 rounded-full border border-orange-200 bg-white outline-none placeholder:text-stone-400 focus:border-orange-400 ${pad}`}
      />
      <button
        type="submit"
        className={`rounded-full bg-orange-800 font-medium text-orange-50 transition-colors hover:bg-orange-900 ${btnPad}`}
      >
        {t("searchBar.button")}
      </button>
    </form>
  );
}
