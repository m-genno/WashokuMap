"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RestaurantSearchResult } from "@/lib/restaurants";
import type { RecentReview } from "@/lib/reviews";
import FavoriteButton from "./FavoriteButton";
import MapLoading from "./MapLoading";
import Pagination from "./Pagination";
import type { SearchFilterState } from "./SearchFilters";
import { translator, pickTranslation, type Locale, type TFn } from "@/lib/i18n";

// Leaflet は window 依存のためクライアントのみで読み込む。
const RestaurantMap = dynamic(() => import("./RestaurantMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

/** 口コミプレビュー本文の最大文字数(超過分は "..." に置き換え)。 */
const REVIEW_PREVIEW_MAX_CHARS = 100;

function truncateBody(text: string): string {
  return text.length > REVIEW_PREVIEW_MAX_CHARS
    ? `${text.slice(0, REVIEW_PREVIEW_MAX_CHARS)}...`
    : text;
}

export default function SearchResultsView({
  results,
  locale = "ja",
  page = 1,
  perPage = 20,
  total = 0,
  searchState = {},
}: {
  results: RestaurantSearchResult[];
  locale?: Locale;
  /** 現在のページ(1始まり) */
  page?: number;
  perPage?: number;
  /** 絞り込み後の総件数 */
  total?: number;
  /** ページ移動時にURLへ引き継ぐ検索条件 */
  searchState?: SearchFilterState;
}) {
  const t = translator(locale);
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // 検索条件を保ったまま page だけ差し替えて遷移する。
  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (searchState.q) params.set("q", searchState.q);
    if (searchState.genre) params.set("genre", searchState.genre);
    if (searchState.lat) params.set("lat", searchState.lat);
    if (searchState.lng) params.set("lng", searchState.lng);
    if (searchState.radius) params.set("radius", searchState.radius);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 口コミプレビュー: 開いている店舗ID(同時に1件)と取得結果のキャッシュ。
  const [reviewsOpenId, setReviewsOpenId] = useState<string | null>(null);
  const [reviewPreviews, setReviewPreviews] = useState<
    Record<string, RecentReview[] | "error">
  >({});

  async function toggleReviews(restaurantId: string) {
    setReviewsOpenId((cur) => (cur === restaurantId ? null : restaurantId));
    if (reviewPreviews[restaurantId]) return;
    try {
      const res = await fetch(
        `/api/restaurants/${restaurantId}/reviews/recent`
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: { reviews: RecentReview[] } = await res.json();
      setReviewPreviews((prev) => ({ ...prev, [restaurantId]: data.reviews }));
    } catch {
      setReviewPreviews((prev) => ({ ...prev, [restaurantId]: "error" }));
    }
  }

  // マーカー選択時、一覧の該当項目を見える位置へスクロール。
  useEffect(() => {
    if (selectedId && itemRefs.current[selectedId]) {
      itemRefs.current[selectedId]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedId]);

  if (results.length === 0) {
    return (
      <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
        {t("results.empty")}
      </p>
    );
  }

  return (
    <div className="md:grid md:grid-cols-2">
      {/* 地図: モバイルは上部固定高、デスクトップは画面追従 */}
      <div className="h-64 md:sticky md:top-0 md:h-[calc(100vh-65px)]">
        <RestaurantMap
          results={results}
          selectedId={selectedId}
          onSelect={setSelectedId}
          locale={locale}
        />
      </div>

      {/* 一覧 */}
      <div>
        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={goToPage}
          prevLabel={t("pager.prev")}
          nextLabel={t("pager.next")}
          rangeLabel={(start, end, tot) =>
            t("pager.range", { start, end, total: tot })
          }
          className="px-4 pt-4"
        />
        <ul className="flex flex-col gap-3 px-4 pb-4 pt-3">
        {results.map((r) => {
          const selected = r.id === selectedId;
          const displayName = pickTranslation(r.name_translations, locale, r.name);
          return (
            <li
              key={r.id}
              ref={(el) => {
                itemRefs.current[r.id] = el;
              }}
              className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                selected
                  ? "border-amber-500 ring-2 ring-amber-300"
                  : "border-orange-100 hover:border-orange-300"
              }`}
            >
              {/* 評価はプレビュー開閉ボタンのため、選択ボタンの外に置く(button入れ子回避) */}
              <div className="flex items-baseline justify-between gap-3 p-4 pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h2 className="font-semibold">{displayName}</h2>
                </button>
                {r.rating_count > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleReviews(r.id)}
                    aria-expanded={reviewsOpenId === r.id}
                    className="shrink-0 text-sm text-amber-600 hover:underline"
                    title={t("detail.sectionReviews")}
                  >
                    ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
                    <span className="ml-0.5 text-[10px]">
                      {reviewsOpenId === r.id ? "▲" : "▼"}
                    </span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="w-full px-4 pb-2 text-left"
              >
                {displayName !== r.name && (
                  <p className="text-sm text-stone-500">{r.name}</p>
                )}
                {r.address && (
                  <p className="mt-1 text-sm text-stone-600">{r.address}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {r.price_range && <span>{"¥".repeat(r.price_range)}</span>}
                  <span>
                    {t("results.reservationLabel")}: {t(`resv.${r.reservation_mode}`)}
                  </span>
                  {r.distance_m != null && (
                    <span>{Math.round(r.distance_m)} m</span>
                  )}
                </div>
              </button>
              {reviewsOpenId === r.id && (
                <ReviewPreviewPanel
                  restaurantId={r.id}
                  preview={reviewPreviews[r.id]}
                  locale={locale}
                  t={t}
                />
              )}
              <div className="flex items-center justify-between px-4 pb-3">
                <Link
                  href={`/restaurants/${r.id}`}
                  className="text-sm font-medium text-orange-800 hover:text-orange-900"
                >
                  {t("results.detail")}
                </Link>
                <FavoriteButton
                  locale={locale}
                  item={{
                    id: r.id,
                    name: r.name,
                    nameEn: r.name_translations?.en,
                    address: r.address,
                  }}
                />
              </div>
            </li>
          );
        })}
        </ul>
        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={goToPage}
          prevLabel={t("pager.prev")}
          nextLabel={t("pager.next")}
          rangeLabel={(start, end, tot) =>
            t("pager.range", { start, end, total: tot })
          }
          className="px-4 pb-6"
        />
      </div>
    </div>
  );
}

/** 検索結果カード内の口コミプレビュー(最新5件の概要+詳細リンク)。 */
function ReviewPreviewPanel({
  restaurantId,
  preview,
  locale,
  t,
}: {
  restaurantId: string;
  preview: RecentReview[] | "error" | undefined;
  locale: Locale;
  t: TFn;
}) {
  return (
    <div className="border-t border-orange-100 px-4 py-3">
      {preview === undefined ? (
        <p className="text-xs text-stone-500">{t("results.reviewsLoading")}</p>
      ) : preview === "error" ? (
        <p className="text-xs text-stone-500">{t("results.reviewsError")}</p>
      ) : preview.length === 0 ? (
        <p className="text-xs text-stone-500">{t("detail.noReviews")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {preview.map((rv) => {
              // 日本語UIでは日本語訳キャッシュがあればそちらを表示(詳細画面と同方針)。
              const body =
                locale === "ja" &&
                rv.body_lang !== "ja" &&
                rv.body_translations?.ja
                  ? rv.body_translations.ja
                  : rv.body;
              return (
                <li key={rv.id} className="rounded-lg bg-orange-50/70 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-600">
                      {"★".repeat(rv.rating)}
                      <span className="text-stone-300">
                        {"★".repeat(5 - rv.rating)}
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {new Date(rv.created_at).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  {body && (
                    <p className="mt-1 text-xs text-stone-700">
                      {truncateBody(body)}
                    </p>
                  )}
                  {rv.photos.length > 0 && (
                    <div className="mt-1.5 flex gap-1.5">
                      {rv.photos.slice(0, 2).map((ph) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={ph.url}
                          src={ph.thumbUrl ?? ph.url}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            href={`/restaurants/${restaurantId}#reviews`}
            className="mt-2 inline-block text-sm font-medium text-orange-800 hover:text-orange-900"
          >
            {t("results.reviewsAll")}
          </Link>
        </>
      )}
    </div>
  );
}
