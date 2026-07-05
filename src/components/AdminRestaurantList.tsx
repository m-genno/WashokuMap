"use client";

import { useEffect, useState } from "react";
import { adminHeaders } from "@/lib/adminClient";
import Pagination from "./Pagination";
import AdminRestaurantRows, {
  type RestaurantRow as Row,
  type RestaurantRowStatus as Status,
} from "./AdminRestaurantRows";

const PER_PAGE = 50;

const FILTERS: { key: string; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "published", label: "公開中" },
  { key: "closed", label: "休止" },
  { key: "all", label: "すべて" },
];

export default function AdminRestaurantList() {
  const [filter, setFilter] = useState("draft");
  const [q, setQ] = useState(""); // 入力中の語句
  const [appliedQ, setAppliedQ] = useState(""); // 検索実行された語句
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // フィルタ変更・操作後の再取得トリガ。
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
          `/api/admin/restaurants?status=${filter}&q=${encodeURIComponent(appliedQ)}&page=${page}&perPage=${PER_PAGE}`,
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
        // 再読み込みで件数が減り現在ページが範囲外になったら最終ページへ寄せる。
        const lastPage = Math.max(1, Math.ceil((data.total ?? 0) / PER_PAGE));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRows(data.restaurants);
        setTotal(data.total ?? data.restaurants.length);
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
  }, [filter, appliedQ, page, reloadKey]);

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
      {/* 語句検索(店名・住所・多言語名・紹介文) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQ(q.trim());
          setPage(1);
        }}
        className="mb-3 flex gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="店名・住所・英名などで検索"
          className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm outline-none focus:border-orange-400"
        />
        <button
          type="submit"
          className="rounded-full bg-orange-800 px-4 py-1.5 text-sm font-medium text-orange-50 hover:bg-orange-900"
        >
          検索
        </button>
        {appliedQ && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setAppliedQ("");
              setPage(1);
            }}
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:border-orange-400"
          >
            クリア
          </button>
        )}
      </form>

      {appliedQ && (
        <p className="mb-3 text-xs text-stone-500">
          「{appliedQ}」で絞り込み中
        </p>
      )}

      {/* ステータスタブ */}
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
          該当する店舗はありません。
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
          <AdminRestaurantRows
            rows={rows}
            busyId={busyId}
            onChangeStatus={changeStatus}
          />
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
