"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";

type Status = "draft" | "published" | "closed";

interface Row {
  id: string;
  name: string;
  name_translations: Record<string, string>;
  address: string | null;
  phone: string | null;
  reservation_mode: string;
  price_range: number | null;
  status: Status;
  source: string;
  has_location: boolean;
  genres: string[];
  created_at: string;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "published", label: "公開中" },
  { key: "closed", label: "休止" },
  { key: "all", label: "すべて" },
];

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-200 text-stone-600",
};
const STATUS_LABEL: Record<Status, string> = {
  draft: "下書き",
  published: "公開中",
  closed: "休止",
};

export default function AdminRestaurantList() {
  const [filter, setFilter] = useState("draft");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // フィルタ変更・操作後の再取得トリガ。
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/restaurants?status=${filter}`, {
          headers: adminHeaders(),
        });
        if (cancelled) return;
        if (res.status === 401) {
          setError("認証が必要です。上のトークンを入力してください。");
          setRows([]);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(`取得に失敗しました: ${data.error ?? "unknown"}`);
          setRows([]);
          return;
        }
        setRows(data.restaurants);
      } catch {
        if (!cancelled) {
          setError("通信エラー");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  async function changeStatus(id: string, status: Status) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/restaurants/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`更新に失敗しました: ${data.error ?? "unknown"}`);
        return;
      }
      // 現在のフィルタから外れた行は消える。再取得で整合。
      reload();
    } catch {
      setError("通信エラー");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* ステータスタブ */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              filter === f.key
                ? "border-orange-800 bg-orange-800 text-orange-50"
                : "border-stone-300 bg-white text-stone-700 hover:border-orange-400"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={reload}
          className="ml-auto rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-600 hover:border-orange-400"
        >
          再読み込み
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-sm text-stone-500">
          該当する店舗はありません。
        </p>
      ) : (
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
                    <p className="text-sm text-stone-500">
                      {r.name_translations.en}
                    </p>
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
                      title={
                        r.has_location ? "" : "位置情報がないため公開できません"
                      }
                      onClick={() => changeStatus(r.id, "published")}
                      className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-medium text-emerald-50 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      公開する
                    </button>
                  )}
                  {r.status !== "draft" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => changeStatus(r.id, "draft")}
                      className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 hover:border-amber-400 disabled:opacity-50"
                    >
                      下書きに戻す
                    </button>
                  )}
                  {r.status !== "closed" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => changeStatus(r.id, "closed")}
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
      )}
    </div>
  );
}
