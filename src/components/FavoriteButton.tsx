"use client";

import { useFavorites, type FavoriteInput } from "@/lib/clientStore";
import { translator, type Locale } from "@/lib/i18n";

/** お気に入りトグル(♥)。匿名でも localStorage に保存される。 */
export default function FavoriteButton({
  item,
  className = "",
  locale = "ja",
}: {
  item: FavoriteInput;
  className?: string;
  locale?: Locale;
}) {
  const { isFavorite, toggle } = useFavorites();
  const t = translator(locale);
  const fav = isFavorite(item.id);
  const label = fav ? t("fav.removeAria") : t("fav.add");

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      className={`select-none text-xl leading-none transition-colors ${
        fav ? "text-rose-500" : "text-stone-300 hover:text-rose-400"
      } ${className}`}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
