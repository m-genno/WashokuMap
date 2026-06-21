import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getRestaurantById,
  type RestaurantHours,
} from "@/lib/restaurants";
import DetailMap from "@/components/DetailMap";

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
          <Link
            href="/search"
            className="ml-auto text-sm text-stone-500 hover:text-stone-800"
          >
            ← 検索に戻る
          </Link>
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
            <h1 className="text-2xl font-bold">{r.name}</h1>
            {r.rating_count > 0 && (
              <span className="shrink-0 pt-1 text-amber-600">
                ★ {r.rating_avg.toFixed(1)}（{r.rating_count}）
              </span>
            )}
          </div>
          {r.name_translations?.en && (
            <p className="text-stone-500">{r.name_translations.en}</p>
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
                {g.name_translations?.ja ?? g.code}
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
        />

        {/* 説明 */}
        {r.description && (
          <section className="mb-6">
            <h2 className="mb-1 font-semibold">紹介</h2>
            <p className="text-stone-700">{r.description}</p>
          </section>
        )}

        {/* 営業時間 */}
        {r.hours.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 font-semibold">営業時間</h2>
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
          <h2 className="mb-2 font-semibold">アクセス</h2>
          {r.address && <p className="mb-2 text-stone-700">{r.address}</p>}
          {r.lat != null && r.lng != null ? (
            <div className="h-64 overflow-hidden rounded-xl">
              <DetailMap id={r.id} name={r.name} lat={r.lat} lng={r.lng} />
            </div>
          ) : (
            <p className="text-sm text-stone-500">位置情報は未登録です。</p>
          )}
        </section>

        {/* 口コミ */}
        <section className="mb-10">
          <h2 className="mb-2 font-semibold">
            口コミ {r.reviews.length > 0 && `(${r.reviews.length})`}
          </h2>
          {r.reviews.length === 0 ? (
            <p className="text-sm text-stone-500">
              まだ口コミがありません。予約・来店された方が投稿できます。
            </p>
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
}: {
  mode: "request" | "external" | "phone_only";
  reservationUrl: string | null;
  phone: string | null;
  id: string;
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
          公式サイトで予約
        </a>
      ) : mode === "phone_only" ? (
        phone ? (
          <a href={`tel:${phone}`} className={primaryClass}>
            電話で予約 {phone}
          </a>
        ) : (
          <p className="text-sm text-stone-500">
            このお店は電話予約のみですが、電話番号が未登録です。
          </p>
        )
      ) : (
        // request モード
        <div className="flex flex-wrap items-center gap-3">
          {/* 予約フォームは次フェーズ。今は導線のみ用意。 */}
          <Link href={`/restaurants/${id}/reserve`} className={primaryClass}>
            予約をリクエスト
          </Link>
          {phone && (
            <a href={`tel:${phone}`} className={secondaryClass}>
              電話で問い合わせ
            </a>
          )}
        </div>
      )}
    </section>
  );
}
