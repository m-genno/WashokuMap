"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminHeaders } from "@/lib/adminClient";
import Pagination from "./Pagination";
import {
  ACTION_BADGE,
  ACTION_LABEL,
  FIELD_LABEL,
  fmtDate,
  readChanges,
  targetLink,
  type AuditRow,
} from "./auditPresentation";

/** 操作履歴のため表示量は多め(1ページ100件)。 */
const PER_PAGE = 100;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "restaurant.update", label: "店舗編集" },
  { key: "restaurant.status", label: "店舗状態" },
  { key: "restaurant.create", label: "店舗登録" },
  { key: "restaurant.import", label: "CSV取込" },
  { key: "reservation.status", label: "予約対応" },
  { key: "review.moderate", label: "口コミ対応" },
];

export default function AdminAuditList() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
          `/api/admin/audit?action=${filter}&page=${page}&perPage=${PER_PAGE}`,
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
        setRows(data.entries);
        setTotal(data.total ?? data.entries.length);
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
          記録がありません。
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
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const link = targetLink(r);
            const changes = readChanges(r.detail);
            return (
              <li
                key={r.id}
                onClick={() => router.push(`/mayuchan/audit/${r.id}`)}
                className="cursor-pointer rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm transition-colors hover:border-orange-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ACTION_BADGE[r.action] ?? "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {ACTION_LABEL[r.action] ?? r.action}
                  </span>
                  <span className="text-stone-800">{r.summary}</span>
                  <span className="ml-auto text-xs text-stone-400">
                    {fmtDate(r.created_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                  <span>操作者: {r.actor}</span>
                  {r.ip && <span>IP: {r.ip}</span>}
                  {link ? (
                    <Link
                      href={link}
                      onClick={(e) => e.stopPropagation()}
                      className="text-orange-800 hover:text-orange-900"
                    >
                      対象を開く →
                    </Link>
                  ) : (
                    r.target_id && (
                      <span className="font-mono">{r.target_id.slice(0, 8)}</span>
                    )
                  )}
                  <Link
                    href={`/mayuchan/audit/${r.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto text-orange-800 hover:text-orange-900"
                  >
                    詳細 →
                  </Link>
                </div>

                {changes.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-stone-500">変更項目:</span>
                    {changes.map((c) => (
                      <span
                        key={c.field}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700"
                      >
                        {FIELD_LABEL[c.field] ?? c.field}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
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
