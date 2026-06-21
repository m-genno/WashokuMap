"use client";

// 匿名ユーザのお気に入り・検索履歴をブラウザ(localStorage)に保持する。
// 設計上、匿名時は localStorage が主。将来ログイン時に anonymousId をキーに
// サーバ(favorite / search_history テーブル)へ同期/マージする。

import { useEffect, useState } from "react";

const KEY_ANON = "wm.anonId";
const KEY_FAV = "wm.favorites.v1";
const KEY_HIST = "wm.history.v1";
const HISTORY_LIMIT = 8;
const STORE_EVENT = "wm-store-changed";

export interface FavoriteItem {
  id: string;
  name: string;
  nameEn?: string | null;
  address?: string | null;
  savedAt: number;
}
export type FavoriteInput = Omit<FavoriteItem, "savedAt">;

export interface HistoryItem {
  q: string;
  at: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    // quota 超過などは無視(MVP)
  }
}

/** 端末固有の匿名ID。なければ生成して保存。 */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY_ANON);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY_ANON, id);
  }
  return id;
}

// ---- favorites ----

export function listFavorites(): FavoriteItem[] {
  return read<FavoriteItem[]>(KEY_FAV, []);
}

export function toggleFavorite(item: FavoriteInput): boolean {
  const list = listFavorites();
  const idx = list.findIndex((f) => f.id === item.id);
  let isFav: boolean;
  if (idx >= 0) {
    list.splice(idx, 1);
    isFav = false;
  } else {
    list.unshift({ ...item, savedAt: Date.now() });
    isFav = true;
  }
  write(KEY_FAV, list);
  return isFav;
}

export function removeFavorite(id: string): void {
  write(
    KEY_FAV,
    listFavorites().filter((f) => f.id !== id)
  );
}

// ---- search history ----

export function listHistory(): HistoryItem[] {
  return read<HistoryItem[]>(KEY_HIST, []);
}

export function addHistory(q: string): void {
  const term = q.trim();
  if (!term) return;
  const next = [
    { q: term, at: Date.now() },
    ...listHistory().filter((h) => h.q !== term),
  ].slice(0, HISTORY_LIMIT);
  write(KEY_HIST, next);
}

export function clearHistory(): void {
  write(KEY_HIST, []);
}

// ---- react hooks ----

// SSR と「クライアントの初回レンダ」を一致させるため、初期値は常に空。
// localStorage の実値はマウント後の effect で反映する(ハイドレーション不一致回避)。
function useStoreValue<T>(getter: () => T, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sync = () => setValue(getter());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export function useFavorites() {
  const items = useStoreValue<FavoriteItem[]>(listFavorites, []);
  return {
    items,
    isFavorite: (id: string) => items.some((f) => f.id === id),
    toggle: toggleFavorite,
    remove: removeFavorite,
  };
}

export function useHistory() {
  const items = useStoreValue<HistoryItem[]>(listHistory, []);
  return { items, add: addHistory, clear: clearHistory };
}
