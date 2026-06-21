"use client";

import { useEffect, useState } from "react";
import { getAdminToken, setAdminToken } from "@/lib/adminClient";

/** 運用者トークン入力(sessionStorage に保存)。ADMIN_TOKEN 未設定環境では空で可。 */
export default function AdminTokenField() {
  const [value, setValue] = useState("");
  useEffect(() => {
    // マウント後に sessionStorage を反映(SSRとの不一致回避)
    const sync = () => setValue(getAdminToken());
    sync();
  }, []);

  return (
    <label className="block">
      <span className="text-xs text-stone-500">
        運用者トークン(ADMIN_TOKEN 設定時に必要・この端末のセッションに保存)
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setAdminToken(e.target.value);
        }}
        placeholder="(開発環境では空でも可)"
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
      />
    </label>
  );
}
