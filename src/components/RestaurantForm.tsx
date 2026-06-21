"use client";

import { useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";

export interface GenreOption {
  code: string;
  label: string;
}

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string; lat: number | null; lng: number | null; geocoded: boolean }
  | { kind: "error"; message: string };

const label = "block text-sm font-medium text-stone-700";
const input =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400";

export default function RestaurantForm({ genres }: { genres: GenreOption[] }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [mode, setMode] = useState("request");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "submitting" });
    const fd = new FormData(e.currentTarget);

    const payload = {
      name: String(fd.get("name") || "").trim(),
      nameEn: String(fd.get("nameEn") || "").trim() || null,
      description: String(fd.get("description") || "").trim() || null,
      address: String(fd.get("address") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      websiteUrl: String(fd.get("websiteUrl") || "").trim() || null,
      reservationMode: String(fd.get("reservationMode") || "request"),
      reservationUrl: String(fd.get("reservationUrl") || "").trim() || null,
      priceRange: fd.get("priceRange") ? Number(fd.get("priceRange")) : null,
      status: String(fd.get("status") || "draft"),
      genres: fd.getAll("genres").map(String),
    };

    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "failed" });
        return;
      }
      setState({ kind: "success", ...data.restaurant });
    } catch {
      setState({ kind: "error", message: "network_error" });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <h2 className="mb-1 font-semibold text-emerald-900">登録しました</h2>
        <p className="text-emerald-800">ID: <span className="font-mono">{state.id}</span></p>
        <p className="text-emerald-800">
          位置:{" "}
          {state.lat != null && state.lng != null
            ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)} ${
                state.geocoded ? "(住所からジオコーディング)" : ""
              }`
            : "未取得(住所から特定できませんでした。後で手動設定してください)"}
        </p>
        <div className="mt-3 flex gap-3">
          <Link href={`/restaurants/${state.id}`} className="text-emerald-900 underline">
            店舗ページを見る
          </Link>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="text-emerald-900 underline"
          >
            続けて登録
          </button>
        </div>
      </div>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label>
        <span className={label}>店名 *</span>
        <input name="name" required className={input} />
      </label>
      <label>
        <span className={label}>店名(英語)</span>
        <input name="nameEn" className={input} placeholder="Sushi Tanaka" />
      </label>
      <label>
        <span className={label}>住所(ジオコーディングで地図表示)</span>
        <input name="address" className={input} placeholder="東京都渋谷区道玄坂1-2-3" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={label}>電話</span>
          <input name="phone" className={input} />
        </label>
        <label>
          <span className={label}>Webサイト</span>
          <input name="websiteUrl" className={input} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={label}>予約方式</span>
          <select
            name="reservationMode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={input}
          >
            <option value="request">リクエスト予約(アプリ内)</option>
            <option value="external">外部サイト</option>
            <option value="phone_only">電話のみ</option>
          </select>
        </label>
        <label>
          <span className={label}>価格帯</span>
          <select name="priceRange" className={input} defaultValue="">
            <option value="">(未設定)</option>
            <option value="1">¥</option>
            <option value="2">¥¥</option>
            <option value="3">¥¥¥</option>
            <option value="4">¥¥¥¥</option>
          </select>
        </label>
      </div>

      {mode === "external" && (
        <label>
          <span className={label}>外部予約URL</span>
          <input name="reservationUrl" className={input} placeholder="https://..." />
        </label>
      )}

      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">ジャンル</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {genres.map((g) => (
            <label key={g.code} className="flex items-center gap-1">
              <input type="checkbox" name="genres" value={g.code} /> {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span className={label}>紹介文</span>
        <textarea name="description" rows={3} className={input} />
      </label>

      <label>
        <span className={label}>公開状態</span>
        <select name="status" className={input} defaultValue="draft">
          <option value="draft">下書き(非公開)</option>
          <option value="published">公開</option>
        </select>
      </label>

      {state.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          登録に失敗しました（{state.message}）
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900 disabled:opacity-60"
      >
        {submitting ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
