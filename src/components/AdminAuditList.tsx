"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";

interface Row {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  detail: Record<string, unknown>;
  actor: string;
  ip: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "restaurant.create": "店舗登録",
  "restaurant.update": "店舗編集",
  "restaurant.status": "店舗状態",
  "restaurant.import": "CSV取込",
  "reservation.status": "予約対応",
  "review.moderate": "口コミ対応",
};

const ACTION_BADGE: Record<string, string> = {
  "restaurant.create": "bg-emerald-100 text-emerald-800",
  "restaurant.update": "bg-blue-100 text-blue-800",
  "restaurant.status": "bg-amber-100 text-amber-800",
  "restaurant.import": "bg-violet-100 text-violet-800",
  "reservation.status": "bg-orange-100 text-orange-800",
  "review.moderate": "bg-rose-100 text-rose-800",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "restaurant.update", label: "店舗編集" },
  { key: "restaurant.status", label: "店舗状態" },
  { key: "restaurant.create", label: "店舗登録" },
  { key: "restaurant.import", label: "CSV取込" },
  { key: "reservation.status", label: "予約対応" },
  { key: "review.moderate", label: "口コミ対応" },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FIELD_LABEL: Record<string, string> = {
  name: "店名",
  name_en: "店名(英語)",
  description: "紹介文",
  address: "住所",
  lat: "緯度",
  lng: "経度",
  phone: "電話",
  website_url: "Webサイト",
  reservation_mode: "予約方式",
  reservation_url: "予約URL",
  price_range: "価格帯",
  status: "公開状態",
  genres: "ジャンル",
  photos: "写真数",
  hours: "営業時間数",
};

interface FieldChange {
  from: unknown;
  to: unknown;
}

/** 差分の値を短く表示用に整形。 */
function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(なし)";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(なし)";
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

/** detail.changes(あれば)を {field, from, to} の配列に変換。 */
function readChanges(detail: Record<string, unknown>): {
  field: string;
  from: unknown;
  to: unknown;
}[] {
  const raw = detail?.changes;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, FieldChange>).map(
    ([field, ch]) => ({ field, from: ch?.from, to: ch?.to })
  );
}

/** 監査対象へのリンク(店舗のみ編集画面へ)。 */
function targetLink(r: Row): string | null {
  if (r.target_type === "restaurant" && r.target_id) {
    return `/admin/restaurants/${r.target_id}/edit`;
  }
  return null;
}

export default function AdminAuditList() {
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/audit?action=${filter}`, {
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
        setRows(data.entries);
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

  return (
    <div>
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
          記録がありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const link = targetLink(r);
            const changes = readChanges(r.detail);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm"
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
                    {fmt(r.created_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                  <span>操作者: {r.actor}</span>
                  {r.ip && <span>IP: {r.ip}</span>}
                  {link ? (
                    <Link
                      href={link}
                      className="text-orange-800 hover:text-orange-900"
                    >
                      対象を開く →
                    </Link>
                  ) : (
                    r.target_id && (
                      <span className="font-mono">{r.target_id.slice(0, 8)}</span>
                    )
                  )}
                </div>

                {changes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5 rounded-lg bg-stone-50 p-2 text-xs">
                    {changes.map((c) => (
                      <li key={c.field} className="flex flex-wrap gap-1">
                        <span className="font-medium text-stone-600">
                          {FIELD_LABEL[c.field] ?? c.field}:
                        </span>
                        <span className="text-stone-400 line-through">
                          {fmtVal(c.from)}
                        </span>
                        <span className="text-stone-400">→</span>
                        <span className="text-stone-800">{fmtVal(c.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
