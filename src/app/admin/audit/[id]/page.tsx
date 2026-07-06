import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminAuditDetail from "@/components/AdminAuditDetail";

export const metadata: Metadata = { title: "操作ログ詳細(管理)" };

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <Link href="/admin/audit" className="text-stone-600 hover:text-orange-800">
            操作ログ
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">詳細</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <div className="mb-4">
          <Link
            href="/admin/audit"
            className="text-sm text-orange-800 hover:text-orange-900"
          >
            ← 操作ログ一覧へ戻る
          </Link>
        </div>
        <AdminAuditDetail id={id} />
      </main>
    </div>
  );
}
