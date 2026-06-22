"use client";

import { useState } from "react";
import Link from "next/link";
import { getAnonymousId } from "@/lib/clientStore";
import { translator, type Locale } from "@/lib/i18n";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "ko", label: "한국어" },
];

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string; status: string }
  | { kind: "error"; message: string };

export default function ReservationForm({
  restaurantId,
  locale = "ja",
}: {
  restaurantId: string;
  locale?: Locale;
}) {
  const t = translator(locale);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "submitting" });
    const fd = new FormData(e.currentTarget);

    const date = String(fd.get("date") || "");
    const time = String(fd.get("time") || "");
    const desiredAt = date && time ? `${date}T${time}` : "";

    const allergiesRaw = String(fd.get("allergies") || "").trim();
    const dietary = {
      vegetarian: fd.get("vegetarian") === "on",
      halal: fd.get("halal") === "on",
      allergies: allergiesRaw
        ? allergiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };

    const payload = {
      restaurantId,
      anonymousId: getAnonymousId(),
      desiredAt,
      partySize: Number(fd.get("partySize")),
      guestName: String(fd.get("guestName") || ""),
      guestEmail: String(fd.get("guestEmail") || ""),
      guestPhone: String(fd.get("guestPhone") || ""),
      guestLang: String(fd.get("guestLang") || "en"),
      requests: String(fd.get("requests") || ""),
      budgetPerPerson: fd.get("budget") ? Number(fd.get("budget")) : null,
      dietary,
    };

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "request_failed" });
        return;
      }
      setState({
        kind: "success",
        id: data.reservation.id,
        status: data.reservation.status,
      });
    } catch {
      setState({ kind: "error", message: "network_error" });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="mb-1 font-semibold text-emerald-900">
          {t("reserve.successTitle")}
        </h2>
        <p className="text-sm text-emerald-800">{t("reserve.successBody")}</p>
        <dl className="mt-3 text-sm text-emerald-900">
          <div className="flex gap-2">
            <dt className="text-emerald-700">{t("reserve.refNo")}</dt>
            <dd className="font-mono">{state.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-emerald-700">{t("reserve.status")}</dt>
            <dd>{state.status}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/reservations/${state.id}`}
            className="inline-block rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-800"
          >
            {t("resvStatus.viewStatus")}
          </Link>
          <Link
            href={`/restaurants/${restaurantId}`}
            className="inline-block rounded-full border border-emerald-300 px-5 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            {t("reserve.back")}
          </Link>
        </div>
      </div>
    );
  }

  const submitting = state.kind === "submitting";
  const labelClass = "block text-sm font-medium text-stone-700";
  const inputClass =
    "mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>{t("reserve.date")}</span>
          <input type="date" name="date" required className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>{t("reserve.time")}</span>
          <input type="time" name="time" required className={inputClass} />
        </label>
      </div>

      <label>
        <span className={labelClass}>{t("reserve.partySize")}</span>
        <input
          type="number"
          name="partySize"
          min={1}
          defaultValue={2}
          required
          className={inputClass}
        />
      </label>

      <label>
        <span className={labelClass}>{t("reserve.name")}</span>
        <input type="text" name="guestName" required className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>{t("reserve.email")}</span>
          <input type="email" name="guestEmail" className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>{t("reserve.phone")}</span>
          <input type="tel" name="guestPhone" className={inputClass} />
        </label>
      </div>

      <label>
        <span className={labelClass}>{t("reserve.lang")}</span>
        <select name="guestLang" defaultValue={locale} className={inputClass}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="rounded-lg border border-orange-100 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">
          {t("reserve.dietary")}
        </legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="vegetarian" /> {t("reserve.vegetarian")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="halal" /> {t("reserve.halal")}
          </label>
        </div>
        <label className="mt-2 block">
          <span className="text-sm text-stone-600">
            {t("reserve.allergies")}
          </span>
          <input
            type="text"
            name="allergies"
            placeholder="shrimp, soba"
            className={inputClass}
          />
        </label>
      </fieldset>

      <label>
        <span className={labelClass}>{t("reserve.budget")}</span>
        <input type="number" name="budget" min={0} className={inputClass} />
      </label>

      <label>
        <span className={labelClass}>{t("reserve.requests")}</span>
        <textarea
          name="requests"
          rows={3}
          placeholder={t("reserve.requestsPlaceholder")}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-stone-400">
          {t("reserve.requestsHint")}
        </span>
      </label>

      {state.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("reserve.failed", { error: state.message })}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900 disabled:opacity-60"
      >
        {submitting ? t("reserve.submitting") : t("reserve.submit")}
      </button>
    </form>
  );
}
