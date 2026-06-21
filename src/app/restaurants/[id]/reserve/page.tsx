import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantById } from "@/lib/restaurants";

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

// 予約リクエストフォームは次フェーズで実装。現時点は導線確保のためのプレースホルダ。
export default async function ReservePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRestaurantById(id);
  if (!r) notFound();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-orange-50 px-6 text-center font-sans">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-800 font-serif text-2xl font-bold text-orange-50">
        和
      </span>
      <h1 className="text-xl font-semibold text-stone-900">{r.name} の予約</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-600">
        予約リクエストフォームは現在準備中です。原文＋自動翻訳でお店へリクエストを送る機能を近日対応します。
      </p>
      <Link
        href={`/restaurants/${id}`}
        className="mt-5 rounded-full border border-orange-300 px-5 py-2 text-sm font-medium text-orange-900 hover:bg-orange-100"
      >
        ← 店舗詳細に戻る
      </Link>
    </div>
  );
}
