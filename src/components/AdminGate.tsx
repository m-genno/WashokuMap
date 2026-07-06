"use client";

import { useState, type ReactNode } from "react";
import AdminTokenField from "./AdminTokenField";

/**
 * /mayuchan 配下の共通ゲート。トークン欄を表示し、未入力のあいだは
 * ページ内容を隠す。トークンの一致チェックはサーバ側(管理API)が行うため、
 * ここでは「入力済みかどうか」だけを見る。
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  // null = sessionStorage 未読(SSR/初回描画)。未入力と同じく内容は出さない。
  const [token, setToken] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4">
        <AdminTokenField onTokenChange={setToken} />
      </div>
      {token?.trim() ? (
        children
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          認証が必要です。上のトークンを入力してください。
        </p>
      )}
    </>
  );
}
