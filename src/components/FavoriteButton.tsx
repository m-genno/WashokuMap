"use client";

import { useFavorites, type FavoriteInput } from "@/lib/clientStore";

/** お気に入りトグル(♥)。匿名でも localStorage に保存される。 */
export default function FavoriteButton({
  item,
  className = "",
}: {
  item: FavoriteInput;
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(item.id);

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? "お気に入りから削除" : "お気に入りに追加"}
      title={fav ? "お気に入りから削除" : "お気に入りに追加"}
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
