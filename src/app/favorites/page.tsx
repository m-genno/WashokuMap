"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/clientStore";

export default function FavoritesPage() {
  const { items, remove } = useFavorites();

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
          <Link
            href="/search"
            className="ml-auto text-sm text-stone-500 hover:text-stone-800"
          >
            検索する →
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold">お気に入り</h1>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
            お気に入りはまだありません。店舗カードや詳細ページの ♡
            から追加できます(この端末に保存されます)。
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"
              >
                <Link href={`/restaurants/${f.id}`} className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{f.name}</h2>
                  {f.nameEn && (
                    <p className="truncate text-sm text-stone-500">
                      {f.nameEn}
                    </p>
                  )}
                  {f.address && (
                    <p className="truncate text-sm text-stone-600">
                      {f.address}
                    </p>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="shrink-0 rounded-full border border-orange-200 px-3 py-1 text-xs text-stone-600 hover:border-rose-300 hover:text-rose-600"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
