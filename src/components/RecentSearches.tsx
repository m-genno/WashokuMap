"use client";

import Link from "next/link";
import { useHistory } from "@/lib/clientStore";

/** 最近の検索(localStorage)をチップ表示。クリックで再検索。 */
export default function RecentSearches() {
  const { items, clear } = useHistory();
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-stone-500">最近の検索:</span>
      {items.map((h) => (
        <Link
          key={h.q}
          href={`/search?q=${encodeURIComponent(h.q)}`}
          className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs text-stone-700 hover:border-orange-400"
        >
          {h.q}
        </Link>
      ))}
      <button
        type="button"
        onClick={clear}
        className="text-xs text-stone-400 underline hover:text-stone-600"
      >
        履歴を消去
      </button>
    </div>
  );
}
