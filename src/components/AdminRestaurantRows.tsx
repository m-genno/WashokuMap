"use client";

import Link from "next/link";

export type RestaurantRowStatus = "draft" | "published" | "closed";

export interface RestaurantRow {
  id: string;
  name: string;
  name_translations: Record<string, string>;
  address: string | null;
  phone: string | null;
  reservation_mode: string;
  price_range: number | null;
  status: RestaurantRowStatus;
  source: string;
  has_location: boolean;
  genres: string[];
  created_at: string;
}

export const STATUS_BADGE: Record<RestaurantRowStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-200 text-stone-600",
};
export const STATUS_LABEL: Record<RestaurantRowStatus, string> = {
  draft: "下書き",
  published: "公開中",
  closed: "休止",
};

/**
 * 管理用の店舗カード一覧(表示専用)。
 * 店舗一覧とCSV取込後の確認の両方で使う。状態変更は親の onChangeStatus に委譲。
 */
export default function AdminRestaurantRows({
  rows,
  busyId,
  onChangeStatus,
}: {
  rows: RestaurantRow[];
  busyId: string | null;
  onChangeStatus: (id: string, status: RestaurantRowStatus) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{r.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                <span className="text-xs text-stone-400">{r.source}</span>
              </div>
              {r.name_translations?.en && (
                <p className="text-sm text-stone-500">{r.name_translations.en}</p>
              )}
              {r.address && (
                <p className="mt-1 text-sm text-stone-600">{r.address}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                {r.phone && <span>{r.phone}</span>}
                <span>予約: {r.reservation_mode}</span>
                {r.price_range && <span>{"¥".repeat(r.price_range)}</span>}
                <span className={r.has_location ? "" : "text-red-600"}>
                  {r.has_location ? "位置情報あり" : "位置情報なし"}
                </span>
                {r.genres.length > 0 && (
                  <span>ジャンル: {r.genres.join(", ")}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/restaurants/${r.id}/edit`}
              className="rounded-full border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-50"
            >
              編集
            </Link>
            {r.status === "published" ? (
              <Link
                href={`/restaurants/${r.id}`}
                target="_blank"
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-orange-400"
              >
                公開ページを見る ↗
              </Link>
            ) : (
              <span className="text-xs text-stone-400">
                公開すると検索・詳細に表示されます
              </span>
            )}

            <div className="ml-auto flex flex-wrap gap-2">
              {r.status !== "published" && (
                <button
                  type="button"
                  disabled={busyId === r.id || !r.has_location}
                  title={r.has_location ? "" : "位置情報がないため公開できません"}
                  onClick={() => onChangeStatus(r.id, "published")}
                  className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-medium text-emerald-50 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  公開する
                </button>
              )}
              {r.status !== "draft" && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => onChangeStatus(r.id, "draft")}
                  className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 hover:border-amber-400 disabled:opacity-50"
                >
                  下書きに戻す
                </button>
              )}
              {r.status !== "closed" && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => onChangeStatus(r.id, "closed")}
                  className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 disabled:opacity-50"
                >
                  休止
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
