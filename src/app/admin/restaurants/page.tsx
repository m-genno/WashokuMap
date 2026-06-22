import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminRestaurantList from "@/components/AdminRestaurantList";

export const metadata: Metadata = { title: "店舗一覧・公開" };

export default function AdminRestaurantsPage() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">店舗一覧・公開</span>
          <div className="ml-auto flex gap-3 text-sm">
            <Link
              href="/admin/restaurants/new"
              className="text-orange-800 hover:text-orange-900"
            >
              + 登録
            </Link>
            <Link
              href="/admin/restaurants/import"
              className="text-orange-800 hover:text-orange-900"
            >
              CSV
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <p className="mb-4 text-sm text-stone-600">
          投入した店舗は <strong>下書き</strong>{" "}
          です。内容を確認し「公開する」で検索・詳細に表示されます。位置情報がない店舗は公開できません(登録/CSVで住所から補完)。
        </p>
        <AdminRestaurantList />
      </main>
    </div>
  );
}
