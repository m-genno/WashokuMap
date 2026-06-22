import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminAuditList from "@/components/AdminAuditList";

export const metadata: Metadata = { title: "操作ログ(管理)" };

export default function AdminAuditPage() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">操作ログ</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <p className="mb-4 text-sm text-stone-600">
          管理画面での操作(店舗の登録・編集・状態変更、CSV取込、予約対応、口コミ対応)の履歴です。操作者はトークンのハッシュで識別します。
        </p>
        <AdminAuditList />
      </main>
    </div>
  );
}
