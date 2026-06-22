"use client";

import { useEffect, useState } from "react";
import { translate, localeFromDocumentCookie } from "@/lib/i18n";

/**
 * 地図(動的 import)の読み込み中プレースホルダ。
 * next/dynamic の loading は props を受け取れないため、locale は cookie から
 * クライアントで読む。初回は中立表示(…)にしてハイドレーション不一致を回避。
 */
export default function MapLoading() {
  const [text, setText] = useState("");
  useEffect(() => {
    const sync = () =>
      setText(translate(localeFromDocumentCookie(), "map.loading"));
    sync();
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center bg-orange-100 text-sm text-stone-500">
      {text || "…"}
    </div>
  );
}
