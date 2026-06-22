import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminReviewModerationList from "@/components/AdminReviewModerationList";

export const metadata: Metadata = { title: "口コミ モデレーション" };

export default function AdminReviewsPage() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">口コミ モデレーション</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <p className="mb-4 text-sm text-stone-600">
          通報された口コミを確認し、必要に応じて{" "}
          <strong>非表示</strong>{" "}
          にします。非表示にすると公開ページから消え、店舗評価の集計からも除外されます(再公開も可能)。
        </p>
        <AdminReviewModerationList />
      </main>
    </div>
  );
}
