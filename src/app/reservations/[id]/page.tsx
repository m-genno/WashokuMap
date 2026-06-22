import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getReservationById,
  type ReservationStatusValue,
} from "@/lib/reservations";
import ReservationResponse from "@/components/ReservationResponse";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/serverLocale";
import { translator, pickTranslation, BCP47_TAGS } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予約状況 | WashokuMap",
  robots: { index: false }, // 個別予約の参照ページは検索除外。
};

const STATUS_BADGE: Record<ReservationStatusValue, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-200 text-stone-600",
  counter_offer: "bg-blue-100 text-blue-800",
  cancelled: "bg-stone-200 text-stone-600",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
};

export default async function ReservationStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getReservationById(id);
  if (!r) notFound();

  const locale = await getLocale();
  const t = translator(locale);
  const restaurantName = pickTranslation(
    r.restaurant_name_translations,
    locale,
    r.restaurant_name
  );

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(BCP47_TAGS[locale], {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const rowClass = "flex justify-between gap-4 border-b border-orange-100 py-2";
  const dtClass = "text-stone-500";

  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="text-lg font-semibold tracking-tight">
              WashokuMap
            </span>
          </Link>
          <div className="ml-auto">
            <LocaleSwitcher current={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{t("resvStatus.pageTitle")}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE[r.status]}`}
          >
            {t(`resvStatus.s.${r.status}`)}
          </span>
        </div>

        <p className="mb-5 rounded-2xl border border-orange-100 bg-white p-4 text-stone-700">
          {t(`resvStatus.intro.${r.status}`)}
        </p>

        {/* 代替案待ちのとき: 承諾/お断りの導線 */}
        {r.status === "counter_offer" && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              <span className="font-medium">{t("resvStatus.altAt")}: </span>
              {fmt(r.desired_alt_at)}
            </p>
            <ReservationResponse reservationId={r.id} locale={locale} />
          </div>
        )}

        <dl className="rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm">
          <div className={rowClass}>
            <dt className={dtClass}>{t("resvStatus.restaurant")}</dt>
            <dd className="text-right font-medium">
              <Link
                href={`/restaurants/${r.restaurant_id}`}
                className="text-orange-800 hover:text-orange-900"
              >
                {restaurantName}
              </Link>
            </dd>
          </div>
          <div className={rowClass}>
            <dt className={dtClass}>{t("resvStatus.desiredAt")}</dt>
            <dd className="text-right">{fmt(r.desired_at)}</dd>
          </div>
          {r.desired_alt_at && r.status !== "counter_offer" && (
            <div className={rowClass}>
              <dt className={dtClass}>{t("resvStatus.altAt")}</dt>
              <dd className="text-right">{fmt(r.desired_alt_at)}</dd>
            </div>
          )}
          <div className={rowClass}>
            <dt className={dtClass}>{t("resvStatus.partySize")}</dt>
            <dd className="text-right">
              {t("resvStatus.partyUnit", { n: r.party_size })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className={dtClass}>{t("resvStatus.refNo")}</dt>
            <dd className="text-right font-mono text-xs text-stone-500">
              {r.id}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/restaurants/${r.restaurant_id}`}
            className="text-orange-800 hover:text-orange-900"
          >
            {t("resvStatus.toRestaurant")}
          </Link>
          <Link href="/" className="text-stone-500 hover:text-stone-800">
            {t("resvStatus.home")}
          </Link>
        </div>
      </main>
    </div>
  );
}
