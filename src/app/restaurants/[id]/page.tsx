import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getRestaurantById,
  type RestaurantHours,
} from "@/lib/restaurants";
import DetailMap from "@/components/DetailMap";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewForm from "@/components/ReviewForm";
import ReportReviewButton from "@/components/ReportReviewButton";
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
              href="/search"
              className="text-sm text-stone-500 hover:text-stone-800"
            >
              {t("nav.back")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {/* 写真 */}
        {r.photos.length > 0 ? (
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {r.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt={p.caption ?? r.name}
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
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
                <span className="text-amber-600">
                  ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
                </span>
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

        {/* 地図・住所 */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">{t("detail.sectionAccess")}</h2>
          {r.address && <p className="mb-2 text-stone-700">{r.address}</p>}
          {r.lat != null && r.lng != null ? (
            <div className="h-64 overflow-hidden rounded-xl">
              <DetailMap id={r.id} name={displayName} lat={r.lat} lng={r.lng} />
            </div>
          ) : (
            <p className="text-sm text-stone-500">{t("detail.noLocation")}</p>
          )}
        </section>

        {/* 口コミ */}
        <section className="mb-10">
          <h2 className="mb-2 font-semibold">
            {t("detail.sectionReviews")}{" "}
            {r.reviews.length > 0 && `(${r.reviews.length})`}
          </h2>

          {/* 投稿フォーム(予約実績のある匿名ユーザのみ表示) */}
          <div className="mb-4">
            <ReviewForm restaurantId={r.id} locale={locale} />
          </div>

          {r.reviews.length === 0 ? (
            <p className="text-sm text-stone-500">{t("detail.noReviews")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {r.reviews.map((rv) => (
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
                  {locale === "ja" &&
                    rv.body_lang !== "ja" &&
                    rv.body_translations?.ja && (
                      <p className="mt-1 border-l-2 border-orange-100 pl-2 text-sm text-stone-500">
                        {t("detail.translated")}
                        {rv.body_translations.ja}
                      </p>
                    )}
                  {rv.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rv.photos.map((ph) => (
                        <a
                          key={ph.url}
                          href={ph.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ph.thumbUrl ?? ph.url}
                            alt=""
                            loading="lazy"
                            className="h-20 w-20 rounded-lg object-cover hover:opacity-90"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <ReportReviewButton reviewId={rv.id} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
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
  t,
}: {
  mode: "request" | "external" | "phone_only";
  reservationUrl: string | null;
  phone: string | null;
  id: string;
  t: TFn;
}) {
  const primaryClass =
    "inline-flex items-center justify-center rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900";
  const secondaryClass =
    "inline-flex items-center justify-center rounded-full border border-orange-300 px-6 py-3 font-medium text-orange-900 hover:bg-orange-100";

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
          <a href={`tel:${phone}`} className={primaryClass}>
            {t("detail.reservePhone", { phone })}
          </a>
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
          {phone && (
            <a href={`tel:${phone}`} className={secondaryClass}>
              {t("detail.phoneInquiry")}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
