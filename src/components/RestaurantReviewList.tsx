"use client";

import { useState } from "react";
import type { RecentReview } from "@/lib/reviews";
import Pagination from "./Pagination";
import PhotoLightbox from "./PhotoLightbox";
import ReportReviewButton from "./ReportReviewButton";
import TranslateToggle from "./TranslateToggle";
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
              <TranslateToggle
                url={`/api/reviews/${rv.id}/translate?target=${encodeURIComponent(locale)}`}
                cachedText={rv.body_translations?.[locale]}
                locale={locale}
                className="mt-1"
              />
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
