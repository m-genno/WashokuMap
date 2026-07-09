import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getRestaurantById,
  DETAIL_REVIEWS_PER_PAGE,
  type RestaurantHours,
} from "@/lib/restaurants";
import DetailMap from "@/components/DetailMap";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewForm from "@/components/ReviewForm";
import RestaurantReviewList from "@/components/RestaurantReviewList";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/serverLocale";
import { translator, pickTranslation, type TFn } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function hhmm(t: string): string {
  // "18:00:00" -> "18:00"
  return t.slice(0, 5);
}

function groupHours(hours: RestaurantHours[]): Map<number, RestaurantHours[]> {
  const map = new Map<number, RestaurantHours[]>();
  for (const h of hours) {
    const list = map.get(h.day_of_week) ?? [];
    list.push(h);
    map.set(h.day_of_week, list);
  }
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await getRestaurantById(id);
  if (!r) return { title: "店舗が見つかりません" };
  return {
    title: r.name,
    description: r.description ?? `${r.name} の詳細・予約`,
  };
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRestaurantById(id);
  if (!r) notFound();

  const locale = await getLocale();
  const t = translator(locale);
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(
    userAgent
  );
  const displayName = pickTranslation(r.name_translations, locale, r.name);
  const displayDescription = r.description
    ? pickTranslation(r.description_translations, locale, r.description)
    : null;

  const hoursByDay = groupHours(r.hours);

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="sticky top-0 z-[1000] border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="text-lg font-semibold tracking-tight">
              WashokuMap
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher current={locale} />
            <Link
              href="/reservations"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              {t("nav.reservations")}
            </Link>
            <Link
              href="/search"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              {t("nav.back")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {/* 写真(サムネ表示。クリックで元画像) */}
        {r.photos.length > 0 ? (
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {r.photos.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumb_url ?? p.url}
                  alt={p.caption ?? r.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-xl object-cover hover:opacity-90"
                />
              </a>
            ))}
          </div>
        ) : (
          <div className="mb-5 flex aspect-[16/6] items-center justify-center rounded-xl bg-orange-100 text-4xl">
            和
          </div>
        )}

        {/* 見出し */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <div className="flex shrink-0 items-center gap-3 pt-1">
              {r.rating_count > 0 && (
                <a
                  href="#reviews"
                  className="text-amber-600 hover:underline"
                  title={t("detail.sectionReviews")}
                >
                  ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
                </a>
              )}
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
          </div>
          {displayName !== r.name && (
            <p className="text-stone-500">{r.name}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.price_range && (
              <span className="text-sm text-stone-600">
                {"¥".repeat(r.price_range)}
              </span>
            )}
            {r.genres.map((g) => (
              <span
                key={g.code}
                className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-900"
              >
                {pickTranslation(g.name_translations, locale, g.code)}
              </span>
            ))}
          </div>
        </div>

        {/* 予約導線 */}
        <ReservationPanel
          mode={r.reservation_mode}
          reservationUrl={r.reservation_url}
          phone={r.phone}
          id={r.id}
          isMobile={isMobile}
          t={t}
        />

        {/* 説明 */}
        {displayDescription && (
          <section className="mb-6">
            <h2 className="mb-1 font-semibold">{t("detail.sectionIntro")}</h2>
            <p className="text-stone-700">{displayDescription}</p>
          </section>
        )}

        {/* 営業時間 */}
        {r.hours.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 font-semibold">{t("detail.sectionHours")}</h2>
            <table className="w-full max-w-sm text-sm">
              <tbody>
                {DAY_LABELS.map((label, day) => {
                  const list = hoursByDay.get(day);
                  return (
                    <tr key={day} className="border-b border-orange-100">
                      <th className="w-10 py-1 text-left font-medium text-stone-500">
                        {label}
                      </th>
                      <td className="py-1 text-stone-700">
                        {list
                          ? list
                              .map(
                                (h) =>
                                  `${hhmm(h.open_time)}–${hhmm(h.close_time)}`
                              )
                              .join(" / ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* 電話番号 */}
        {r.phone && (
          <section className="mb-6">
            <h2 className="mb-1 font-semibold">{t("detail.sectionPhone")}</h2>
            {isMobile ? (
              <a
                href={`tel:${r.phone}`}
                className="text-stone-700 underline underline-offset-2"
              >
                {r.phone}
              </a>
            ) : (
              <p className="text-stone-700">{r.phone}</p>
            )}
          </section>
        )}

        {/* 地図・住所 */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">{t("detail.sectionAccess")}</h2>
          {r.address && <p className="mb-2 text-stone-700">{r.address}</p>}
          {r.lat != null && r.lng != null ? (
            <>
              <div className="h-64 overflow-hidden rounded-xl">
                <DetailMap
                  id={r.id}
                  name={displayName}
                  lat={r.lat}
                  lng={r.lng}
                  locale={locale}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100"
                >
                  <span aria-hidden="true">🗺️</span>
                  {t("detail.openInGoogleMaps")}
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100"
                >
                  <span aria-hidden="true">📍</span>
                  {t("detail.directions")}
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">{t("detail.noLocation")}</p>
          )}
        </section>

        {/* 口コミ */}
        <section id="reviews" className="mb-10 scroll-mt-20">
          <h2 className="mb-2 font-semibold">
            {t("detail.sectionReviews")}{" "}
            {r.rating_count > 0 && `(${r.rating_count})`}
          </h2>

          {/* 投稿フォーム(予約実績のある匿名ユーザのみ表示) */}
          <div className="mb-4">
            <ReviewForm restaurantId={r.id} locale={locale} />
          </div>

          {r.reviews.length === 0 ? (
            <p className="text-sm text-stone-500">{t("detail.noReviews")}</p>
          ) : (
            <RestaurantReviewList
              restaurantId={r.id}
              locale={locale}
              initialReviews={r.reviews}
              total={r.rating_count}
              perPage={DETAIL_REVIEWS_PER_PAGE}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function ReservationPanel({
  mode,
  reservationUrl,
  phone,
  id,
  isMobile,
  t,
}: {
  mode: "request" | "external" | "phone_only";
  reservationUrl: string | null;
  phone: string | null;
  id: string;
  isMobile: boolean;
  t: TFn;
}) {
  const primaryClass =
    "inline-flex items-center justify-center rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900";
  const secondaryClass =
    "inline-flex items-center justify-center rounded-full border border-orange-300 px-6 py-3 font-medium text-orange-900 hover:bg-orange-100";
  // PC では tel: が使えないため押せない見た目にする
  const primaryDisabledClass =
    "inline-flex cursor-not-allowed items-center justify-center rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 opacity-50";
  const secondaryDisabledClass =
    "inline-flex cursor-not-allowed items-center justify-center rounded-full border border-orange-300 px-6 py-3 font-medium text-orange-900 opacity-50";

  const showDesktopNote = !isMobile && phone != null && mode !== "external";

  return (
    <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-4">
      {mode === "external" && reservationUrl ? (
        <a
          href={reservationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryClass}
        >
          {t("detail.reserveExternal")}
        </a>
      ) : mode === "phone_only" ? (
        phone ? (
          isMobile ? (
            <a href={`tel:${phone}`} className={primaryClass}>
              {t("detail.reservePhone", { phone })}
            </a>
          ) : (
            <span aria-disabled="true" className={primaryDisabledClass}>
              {t("detail.reservePhone", { phone })}
            </span>
          )
        ) : (
          <p className="text-sm text-stone-500">
            {t("detail.phoneOnlyNoPhone")}
          </p>
        )
      ) : (
        // request モード
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/restaurants/${id}/reserve`} className={primaryClass}>
            {t("detail.reserveRequest")}
          </Link>
          {phone &&
            (isMobile ? (
              <a href={`tel:${phone}`} className={secondaryClass}>
                {t("detail.phoneInquiry")}
              </a>
            ) : (
              <span aria-disabled="true" className={secondaryDisabledClass}>
                {t("detail.phoneInquiry")}
              </span>
            ))}
        </div>
      )}
      {showDesktopNote && (
        <p className="mt-2 text-xs text-stone-500">
          {t("detail.phoneDesktopNote")}
        </p>
      )}
    </section>
  );
}
