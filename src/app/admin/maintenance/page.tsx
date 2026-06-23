import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminUploadCleanup from "@/components/AdminUploadCleanup";

export const metadata: Metadata = { title: "メンテナンス(管理)" };

export default function AdminMaintenancePage() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">メンテナンス</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <AdminUploadCleanup />
      </main>
    </div>
  );
}
