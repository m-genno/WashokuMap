"use client";

import { useState } from "react";
import type { RecentReview } from "@/lib/reviews";
import Pagination from "./Pagination";
import PhotoLightbox from "./PhotoLightbox";
import ReportReviewButton from "./ReportReviewButton";
import { translator, type Locale } from "@/lib/i18n";

/**
 * 詳細画面の口コミ一覧(ページング付き)。
 * 1ページ目はサーバレンダリング済みの initialReviews を表示し、
 * ページ切替時は /api/restaurants/[id]/reviews/recent から取得する。
 */
export default function RestaurantReviewList({
  restaurantId,
  locale,
  initialReviews,
  total,
  perPage,
}: {
  restaurantId: string;
  locale: Locale;
  initialReviews: RecentReview[];
  /** 公開中の口コミ総件数(rating_count) */
  total: number;
  perPage: number;
}) {
  const t = translator(locale);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 取得済みページのキャッシュ(1ページ目はSSR分)。
  const [pages, setPages] = useState<Record<number, RecentReview[]>>({
    1: initialReviews,
  });
  // ライトボックス表示中の写真(どの口コミの何枚目か)。null なら非表示。
  const [lightbox, setLightbox] = useState<{
    reviewId: string;
    index: number;
  } | null>(null);
  // 口コミごとの翻訳表示状態(ボタンを押した口コミだけ表示する)。
  const [translations, setTranslations] = useState<
    Record<string, { state: "loading" | "shown" | "error"; text?: string }>
  >({});

  async function toggleTranslation(rv: RecentReview) {
    const current = translations[rv.id];
    if (current?.state === "loading") return;
    if (current?.state === "shown") {
      // 再度押したら非表示に戻す(取得済みテキストは捨ててよい。キャッシュはサーバ側)。
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[rv.id];
        return next;
      });
      return;
    }

    // 投稿時に保存済みの訳(例: 日本語キャッシュ)があれば API を呼ばずに表示。
    const cached = rv.body_translations?.[locale];
    if (cached) {
      setTranslations((prev) => ({
        ...prev,
        [rv.id]: { state: "shown", text: cached },
      }));
      return;
    }

    setTranslations((prev) => ({ ...prev, [rv.id]: { state: "loading" } }));
    try {
      const res = await fetch(
        `/api/reviews/${rv.id}/translate?target=${encodeURIComponent(locale)}`
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: { text: string } = await res.json();
      setTranslations((prev) => ({
        ...prev,
        [rv.id]: { state: "shown", text: data.text },
      }));
    } catch {
      setTranslations((prev) => ({ ...prev, [rv.id]: { state: "error" } }));
    }
  }

  async function changePage(p: number) {
    setError("");
    if (!pages[p]) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/restaurants/${restaurantId}/reviews/recent?page=${p}&perPage=${perPage}`
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: { reviews: RecentReview[] } = await res.json();
        setPages((prev) => ({ ...prev, [p]: data.reviews }));
      } catch {
        setError(t("results.reviewsError"));
        return;
      } finally {
        setLoading(false);
      }
    }
    setPage(p);
    document
      .getElementById("reviews")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const reviews = pages[page] ?? [];

  const pager = (className: string) => (
    <Pagination
      page={page}
      perPage={perPage}
      total={total}
      onPageChange={changePage}
      disabled={loading}
      prevLabel={t("pager.prev")}
      nextLabel={t("pager.next")}
      rangeLabel={(start, end, tot) =>
        t("pager.range", { start, end, total: tot })
      }
      className={className}
    />
  );

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {pager("mb-3")}
      <ul
        className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        {reviews.map((rv) => (
          <li
            key={rv.id}
            className="rounded-xl border border-orange-100 bg-white p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-amber-600">
                {"★".repeat(rv.rating)}
                <span className="text-stone-300">
                  {"★".repeat(5 - rv.rating)}
                </span>
              </span>
              <span className="text-xs text-stone-400">
                {new Date(rv.created_at).toLocaleDateString("ja-JP")}
              </span>
            </div>
            {rv.body && (
              <p className="mt-1 text-sm text-stone-700">{rv.body}</p>
            )}
            {rv.body && rv.body_lang !== locale && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => toggleTranslation(rv)}
                  disabled={translations[rv.id]?.state === "loading"}
                  className="text-xs text-orange-800 underline underline-offset-2 hover:text-orange-900 disabled:opacity-60"
                >
                  {translations[rv.id]?.state === "loading"
                    ? t("review.translating")
                    : translations[rv.id]?.state === "shown"
                      ? t("review.hideTranslation")
                      : t("review.translate")}
                </button>
                {translations[rv.id]?.state === "error" && (
                  <p className="mt-1 text-xs text-red-600">
                    {t("review.translateFailed")}
                  </p>
                )}
                {translations[rv.id]?.state === "shown" && (
                  <p className="mt-1 border-l-2 border-orange-100 pl-2 text-sm text-stone-500">
                    {t("detail.translated")}
                    {translations[rv.id].text}
                  </p>
                )}
              </div>
            )}
            {rv.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {rv.photos.map((ph, i) => (
                  <button
                    type="button"
                    key={ph.url}
                    aria-label={t("lightbox.open")}
                    onClick={() => setLightbox({ reviewId: rv.id, index: i })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ph.thumbUrl ?? ph.url}
                      alt=""
                      loading="lazy"
                      className="h-20 w-20 cursor-pointer rounded-lg object-cover hover:opacity-90"
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <ReportReviewButton reviewId={rv.id} locale={locale} />
            </div>
          </li>
        ))}
      </ul>
      {pager("mt-3")}
      {lightbox &&
        (() => {
          const photos =
            reviews.find((rv) => rv.id === lightbox.reviewId)?.photos ?? [];
          if (photos.length === 0) return null;
          return (
            <PhotoLightbox
              photos={photos.map((ph) => ({ url: ph.url }))}
              index={lightbox.index}
              locale={locale}
              onClose={() => setLightbox(null)}
              onIndexChange={(i) =>
                setLightbox({ reviewId: lightbox.reviewId, index: i })
              }
            />
          );
        })()}
    </div>
  );
}
