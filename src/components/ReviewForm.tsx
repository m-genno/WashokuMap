"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAnonymousId } from "@/lib/clientStore";
import { translator, type Locale } from "@/lib/i18n";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "ko", label: "한국어" },
];

interface MyReview {
  rating: number;
  body: string | null;
  body_lang: string;
}
interface ReviewContext {
  eligible: boolean;
  reservationId: string | null;
  existing: MyReview | null;
}

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; ctx: ReviewContext }
  | { kind: "submitting"; ctx: ReviewContext }
  | { kind: "done" };

/**
 * 口コミ投稿フォーム。予約実績(confirmed/completed)のあるユーザにのみ表示。
 * マウント時に匿名IDで投稿資格を問い合わせ、資格がなければ案内文のみ出す。
 */
export default function ReviewForm({
  restaurantId,
  locale = "ja",
}: {
  restaurantId: string;
  locale?: Locale;
}) {
  const router = useRouter();
  const t = translator(locale);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [bodyLang, setBodyLang] = useState<string>(locale);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const NOT_ELIGIBLE: ReviewContext = {
      eligible: false,
      reservationId: null,
      existing: null,
    };

    const load = async () => {
      const anonId = getAnonymousId();
      if (!anonId) {
        if (!cancelled) setPhase({ kind: "ready", ctx: NOT_ELIGIBLE });
        return;
      }
      try {
        const res = await fetch(
          `/api/restaurants/${restaurantId}/reviews?anonymousId=${encodeURIComponent(anonId)}`
        );
        const ctx = (await res.json()) as ReviewContext;
        if (cancelled) return;
        if (ctx.existing) {
          setRating(ctx.existing.rating);
          setBody(ctx.existing.body ?? "");
          setBodyLang(ctx.existing.body_lang);
        }
        setPhase({ kind: "ready", ctx });
      } catch {
        if (!cancelled) setPhase({ kind: "ready", ctx: NOT_ELIGIBLE });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase.kind !== "ready") return;
    setError("");
    const ctx = phase.ctx;
    setPhase({ kind: "submitting", ctx });
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousId: getAnonymousId(),
          rating,
          body: body.trim() || null,
          bodyLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "review_failed");
        setPhase({ kind: "ready", ctx });
        return;
      }
      setPhase({ kind: "done" });
      router.refresh(); // サーバ側で再取得し一覧へ反映
    } catch {
      setError("network_error");
      setPhase({ kind: "ready", ctx });
    }
  }

  if (phase.kind === "loading") {
    return <p className="text-sm text-stone-400">{t("review.checking")}</p>;
  }

  if (phase.kind === "done") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {t("review.done")}
      </p>
    );
  }

  const ctx = phase.ctx;
  if (!ctx.eligible) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-3 py-2 text-sm text-stone-500">
        {t("review.notEligible")}
      </p>
    );
  }

  const submitting = phase.kind === "submitting";
  const inputClass =
    "mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-orange-100 bg-white p-4"
    >
      <p className="mb-2 text-sm font-medium text-stone-700">
        {ctx.existing ? t("review.titleEdit") : t("review.titleNew")}
      </p>

      {/* 星評価 */}
      <div className="mb-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n}つ星`}
            className={`text-2xl leading-none ${
              n <= rating ? "text-amber-500" : "text-stone-300"
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-stone-500">{rating} / 5</span>
      </div>

      <label className="block">
        <span className="text-sm text-stone-600">{t("review.comment")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-stone-400">
          {t("review.commentHint")}
        </span>
      </label>

      <label className="mt-2 block">
        <span className="text-sm text-stone-600">{t("review.lang")}</span>
        <select
          value={bodyLang}
          onChange={(e) => setBodyLang(e.target.value)}
          className={inputClass}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("review.failed", { error })}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 rounded-full bg-orange-800 px-6 py-2.5 text-sm font-medium text-orange-50 hover:bg-orange-900 disabled:opacity-60"
      >
        {submitting
          ? t("review.submitting")
          : ctx.existing
            ? t("review.update")
            : t("review.submit")}
      </button>
    </form>
  );
}
