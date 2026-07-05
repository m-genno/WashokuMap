"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";
import Pagination from "./Pagination";

const PER_PAGE = 50;

interface Row {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  rating: number;
  body: string | null;
  body_lang: string;
  body_translations: Record<string, string>;
  status: string;
  created_at: string;
  report_count: number;
  reasons: string[];
  photos: { url: string; thumbUrl: string | null }[];
}

const FILTERS: { key: string; label: string }[] = [
  { key: "reported", label: "通報あり" },
  { key: "hidden", label: "非表示中" },
  { key: "all", label: "すべて" },
];

export default function AdminReviewModerationList() {
  const [filter, setFilter] = useState("reported");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const changeFilter = (key: string) => {
    setFilter(key);
    setPage(1);
  };

  const changePage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/admin/reviews?filter=${filter}&page=${page}&perPage=${PER_PAGE}`,
          { headers: adminHeaders() }
        );
        if (cancelled) return;
        if (res.status === 401) {
          setError("認証が必要です。上のトークンを入力してください。");
          setRows([]);
          setTotal(0);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(`取得に失敗しました: ${data.error ?? "unknown"}`);
          setRows([]);
          setTotal(0);
          return;
        }
        // 対応が進んで件数が減り現在ページが範囲外になったら最終ページへ寄せる。
        const lastPage = Math.max(1, Math.ceil((data.total ?? 0) / PER_PAGE));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRows(data.reviews);
        setTotal(data.total ?? data.reviews.length);
      } catch {
        if (!cancelled) {
          setError("通信エラー");
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [filter, page, reloadKey]);

  async function setStatus(id: string, status: "published" | "hidden") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`更新に失敗しました: ${data.error ?? "unknown"}`);
        return;
      }
      reload();
    } catch {
      setError("通信エラー");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => changeFilter(f.key)}
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
          対象の口コミはありません。
        </p>
      ) : (
        <>
        <Pagination
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={changePage}
          disabled={loading}
          className="mb-3"
        />
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                r.status === "hidden" ? "border-stone-300" : "border-amber-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/restaurants/${r.restaurant_id}`}
                  target="_blank"
                  className="font-semibold text-orange-900 hover:underline"
                >
                  {r.restaurant_name}
                </Link>
                <span className="text-amber-600">
                  {"★".repeat(r.rating)}
                  <span className="text-stone-300">
                    {"★".repeat(5 - r.rating)}
                  </span>
                </span>
                {r.status === "hidden" ? (
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">
                    非表示中
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    公開中
                  </span>
                )}
                {r.report_count > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    通報 {r.report_count} 件
                  </span>
                )}
              </div>

              {r.body && (
                <p className="mt-2 text-sm text-stone-800">{r.body}</p>
              )}
              {r.body_lang !== "ja" && r.body_translations?.ja && (
                <p className="mt-1 border-l-2 border-orange-100 pl-2 text-sm text-stone-500">
                  和訳: {r.body_translations.ja}
                </p>
              )}

              {r.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.photos.map((ph) => (
                    <a key={ph.url} href={ph.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ph.thumbUrl ?? ph.url}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {r.reasons.length > 0 && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                  <span className="font-medium">通報理由: </span>
                  {r.reasons.join(" / ")}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-400">
                  {new Date(r.created_at).toLocaleDateString("ja-JP")}
                </span>
                <div className="ml-auto flex gap-2">
                  {r.status !== "hidden" ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, "hidden")}
                      className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-medium text-red-50 hover:bg-red-800 disabled:opacity-50"
                    >
                      非表示にする
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, "published")}
                      className="rounded-full border border-emerald-300 px-4 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      公開に戻す
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Pagination
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={changePage}
          disabled={loading}
          className="mt-3"
        />
        </>
      )}
    </div>
  );
}
