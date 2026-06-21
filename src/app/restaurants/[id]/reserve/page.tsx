import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantById } from "@/lib/restaurants";
import ReservationForm from "@/components/ReservationForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const r = await getRestaurantById(id);
  return { title: r ? `${r.name} を予約` : "予約" };
}

export default async function ReservePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRestaurantById(id);
  if (!r) notFound();

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
          <Link
            href={`/restaurants/${id}`}
            className="ml-auto text-sm text-stone-500 hover:text-stone-800"
          >
            ← 店舗詳細
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="mb-1 text-xl font-bold">{r.name} を予約</h1>
        <p className="mb-5 text-sm text-stone-500">
          {r.name_translations?.en ?? ""}
        </p>

        {r.reservation_mode === "request" ? (
          <ReservationForm restaurantId={r.id} />
        ) : (
          <div className="rounded-2xl border border-orange-200 bg-white p-5 text-stone-700">
            <p>このお店はオンラインのリクエスト予約に対応していません。</p>
            <Link
              href={`/restaurants/${id}`}
              className="mt-3 inline-block text-orange-800 hover:text-orange-900"
            >
              店舗詳細の予約方法を見る →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
