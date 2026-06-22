import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";

export const metadata: Metadata = { title: "管理" };

export default function AdminHome() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
              和
            </span>
            <span className="text-lg font-semibold">WashokuMap 管理</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <p className="mb-4 text-sm text-stone-600">
          店舗データの投入(運用者向け)。本番では <code>ADMIN_TOKEN</code>{" "}
          を設定し、下のトークンを入力してください。
        </p>

        <div className="mb-5">
          <AdminTokenField />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/admin/restaurants"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-orange-300 sm:col-span-2"
          >
            <h2 className="font-semibold">店舗一覧・公開</h2>
            <p className="mt-1 text-sm text-stone-600">
              投入済みの下書きを確認して公開・休止。位置情報の有無も一覧で確認。
            </p>
          </Link>
          <Link
            href="/admin/restaurants/new"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-orange-300"
          >
            <h2 className="font-semibold">店舗を登録</h2>
            <p className="mt-1 text-sm text-stone-600">
              1店舗ずつ入力。住所からジオコーディングして地図に表示。
            </p>
          </Link>
          <Link
            href="/admin/restaurants/import"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-orange-300"
          >
            <h2 className="font-semibold">CSVインポート</h2>
            <p className="mt-1 text-sm text-stone-600">
              営業先リスト等を一括投入。重複は更新、結果をレポート。
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
