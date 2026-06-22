import Link from "next/link";
import type { Metadata } from "next";
import AdminTokenField from "@/components/AdminTokenField";
import AdminReservationList from "@/components/AdminReservationList";

export const metadata: Metadata = { title: "予約デスク" };

export default function AdminReservationsPage() {
  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">予約デスク</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>
        <p className="mb-4 text-sm text-stone-600">
          受け付けた予約リクエストを確認し、店舗とのやり取りに応じて{" "}
          <strong>確定 / お断り / 完了</strong>{" "}
          などへ更新します。操作はすべて履歴(監査ログ)に記録されます。確定・完了にすると、そのお客様はこの店舗の口コミを投稿できます。
        </p>
        <AdminReservationList />
      </main>
    </div>
  );
}
