"use client";

import { useEffect, useState } from "react";
import { getAdminToken, setAdminToken } from "@/lib/adminClient";

/** 運用者トークン入力(sessionStorage に保存)。サーバ側 ADMIN_TOKEN と一致が必須。 */
export default function AdminTokenField({
  onTokenChange,
}: {
  onTokenChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    // マウント後に sessionStorage を反映(SSRとの不一致回避)
    const sync = () => {
      const token = getAdminToken();
      setValue(token);
      onTokenChange?.(token);
    };
    sync();
  }, [onTokenChange]);

  return (
    <label className="block">
      <span className="text-xs text-stone-500">
        運用者トークン(必須・この端末のセッションに保存)
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setAdminToken(e.target.value);
          onTokenChange?.(e.target.value);
        }}
        placeholder="ADMIN_TOKEN の値を入力"
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
      />
    </label>
  );
}
