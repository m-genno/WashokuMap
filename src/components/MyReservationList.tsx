"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnonymousId } from "@/lib/clientStore";
import {
  translator,
  pickTranslation,
  BCP47_TAGS,
  type Locale,
} from "@/lib/i18n";
import type { ReservationStatusValue } from "@/lib/reservations";

interface Row {
  id: string;
  status: ReservationStatusValue;
  desired_at: string;
  desired_alt_at: string | null;
  party_size: number;
  created_at: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_name_translations: Record<string, string> | null;
}

const STATUS_BADGE: Record<ReservationStatusValue, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-200 text-stone-600",
  counter_offer: "bg-blue-100 text-blue-800",
  cancelled: "bg-stone-200 text-stone-600",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; rows: Row[] };

/** この端末(匿名ID)で行った予約の一覧。予約状況ページへの入口。 */
export default function MyReservationList({
  locale = "ja",
}: {
  locale?: Locale;
}) {
  const t = translator(locale);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const anonymousId = getAnonymousId();
        const res = await fetch(
          `/api/reservations?anonymousId=${encodeURIComponent(anonymousId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        setState({ kind: "loaded", rows: data.reservations ?? [] });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="text-sm text-stone-500">{t("myResv.loading")}</p>;
  }
  if (state.kind === "error") {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {t("myResv.error")}
      </p>
    );
  }
  if (state.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-orange-300 bg-white/60 p-6 text-stone-600">
        {t("myResv.empty")}
      </p>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(BCP47_TAGS[locale], {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <ul className="flex flex-col gap-3">
      {state.rows.map((r) => {
        const name = pickTranslation(
          r.restaurant_name_translations,
          locale,
          r.restaurant_name
        );
        return (
          <li key={r.id}>
            <Link
              href={`/reservations/${r.id}`}
              className="block rounded-2xl border border-orange-100 bg-white p-4 shadow-sm hover:border-orange-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                >
                  {t(`resvStatus.s.${r.status}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {fmt(r.desired_at)} ・{" "}
                {t("resvStatus.partyUnit", { n: r.party_size })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
