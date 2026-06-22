"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";

type Status =
  | "requested"
  | "confirmed"
  | "declined"
  | "counter_offer"
  | "cancelled"
  | "completed"
  | "no_show";

interface Row {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: Status;
  party_size: number;
  desired_at: string;
  desired_alt_at: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_lang: string;
  requests: string | null;
  requests_ja: string | null;
  dietary: Record<string, unknown> | null;
  budget_per_person: number | null;
  created_at: string;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "requested", label: "未対応" },
  { key: "confirmed", label: "確定" },
  { key: "completed", label: "完了" },
  { key: "all", label: "すべて" },
];

const STATUS_LABEL: Record<Status, string> = {
  requested: "未対応",
  confirmed: "確定",
  declined: "お断り",
  counter_offer: "代替提案",
  cancelled: "キャンセル",
  completed: "完了",
  no_show: "No-show",
};
const STATUS_BADGE: Record<Status, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-200 text-stone-600",
  counter_offer: "bg-blue-100 text-blue-800",
  cancelled: "bg-stone-200 text-stone-600",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
};

// デスクが押せる遷移(サーバ側 ALLOWED_TRANSITIONS と一致)。
const ACTIONS: Record<Status, { to: Status; label: string; style: string }[]> = {
  requested: [
    { to: "confirmed", label: "確定する", style: "bg-emerald-700 text-emerald-50 hover:bg-emerald-800" },
    { to: "counter_offer", label: "代替を提案", style: "border border-blue-300 text-blue-800 hover:bg-blue-50" },
    { to: "declined", label: "お断り", style: "border border-stone-300 text-stone-700 hover:border-stone-400" },
    { to: "cancelled", label: "キャンセル", style: "border border-stone-300 text-stone-600 hover:border-stone-400" },
  ],
  counter_offer: [
    { to: "confirmed", label: "確定する", style: "bg-emerald-700 text-emerald-50 hover:bg-emerald-800" },
    { to: "declined", label: "お断り", style: "border border-stone-300 text-stone-700 hover:border-stone-400" },
    { to: "cancelled", label: "キャンセル", style: "border border-stone-300 text-stone-600 hover:border-stone-400" },
  ],
  confirmed: [
    { to: "completed", label: "来店済み", style: "bg-emerald-700 text-emerald-50 hover:bg-emerald-800" },
    { to: "no_show", label: "No-show", style: "border border-red-300 text-red-700 hover:bg-red-50" },
    { to: "cancelled", label: "キャンセル", style: "border border-stone-300 text-stone-600 hover:border-stone-400" },
  ],
  declined: [],
  cancelled: [],
  completed: [],
  no_show: [],
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dietarySummary(d: Record<string, unknown> | null): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.vegetarian) parts.push("ベジタリアン");
  if (d.halal) parts.push("ハラル");
  const allergies = Array.isArray(d.allergies) ? (d.allergies as string[]) : [];
  if (allergies.length) parts.push(`アレルギー: ${allergies.join(", ")}`);
  return parts.length ? parts.join(" / ") : null;
}

export default function AdminReservationList() {
  const [filter, setFilter] = useState("requested");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/reservations?status=${filter}`, {
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
        setRows(data.reservations);
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
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "invalid_transition"
            ? `この操作はできません（現在の状態: ${data.from ?? "?"}）。再読み込みします。`
            : `更新に失敗しました: ${data.error ?? "unknown"}`
        );
        reload();
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
          該当する予約はありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const diet = dietarySummary(r.dietary);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/restaurants/${r.restaurant_id}`}
                    target="_blank"
                    className="font-semibold text-orange-900 hover:underline"
                  >
                    {r.restaurant_name}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-stone-700 sm:grid-cols-2">
                  <span>
                    <span className="text-stone-400">希望: </span>
                    {fmtDateTime(r.desired_at)}
                    {r.desired_alt_at && ` / 代替 ${fmtDateTime(r.desired_alt_at)}`}
                  </span>
                  <span>
                    <span className="text-stone-400">人数: </span>
                    {r.party_size} 名
                    {r.budget_per_person != null &&
                      ` ・ 予算 ¥${r.budget_per_person.toLocaleString()}/人`}
                  </span>
                  <span>
                    <span className="text-stone-400">お客様: </span>
                    {r.guest_name}（{r.guest_lang}）
                  </span>
                  <span className="text-stone-600">
                    {r.guest_email && <span className="mr-2">{r.guest_email}</span>}
                    {r.guest_phone && <span>{r.guest_phone}</span>}
                  </span>
                </div>

                {diet && (
                  <p className="mt-1 text-sm text-stone-600">
                    <span className="text-stone-400">食事制限: </span>
                    {diet}
                  </p>
                )}

                {(r.requests || r.requests_ja) && (
                  <div className="mt-2 rounded-lg bg-stone-50 p-2 text-sm">
                    {r.requests_ja && (
                      <p className="text-stone-800">
                        <span className="text-stone-400">要望(和訳): </span>
                        {r.requests_ja}
                      </p>
                    )}
                    {r.requests && (
                      <p className="text-stone-500">
                        <span className="text-stone-400">原文: </span>
                        {r.requests}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-400">
                    受付 {fmtDateTime(r.created_at)}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {ACTIONS[r.status].length === 0 ? (
                      <span className="text-xs text-stone-400">対応済み</span>
                    ) : (
                      ACTIONS[r.status].map((a) => (
                        <button
                          key={a.to}
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => changeStatus(r.id, a.to)}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${a.style}`}
                        >
                          {a.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
