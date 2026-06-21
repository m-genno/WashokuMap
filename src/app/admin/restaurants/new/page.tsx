import Link from "next/link";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import RestaurantForm, { type GenreOption } from "@/components/RestaurantForm";
import AdminTokenField from "@/components/AdminTokenField";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "店舗を登録(管理)" };

export default async function NewRestaurantPage() {
  const genres = await query<{
    code: string;
    name_translations: Record<string, string>;
  }>(`SELECT code, name_translations FROM genre ORDER BY code`);

  const options: GenreOption[] = genres.map((g) => ({
    code: g.code,
    label: g.name_translations?.ja ?? g.code,
  }));

  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">店舗を登録</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <RestaurantForm genres={options} />
      </main>
    </div>
  );
}
