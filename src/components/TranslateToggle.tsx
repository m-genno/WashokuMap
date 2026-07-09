"use client";

import { useState } from "react";
import { translator, type Locale } from "@/lib/i18n";

type State =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "shown"; text: string }
  | { kind: "error" };

/**
 * 「翻訳する」ボタン+翻訳表示のトグル(詳細画面の口コミ・紹介文で共用)。
 * 押すと url(GET で {text} を返すAPI)から翻訳を取得して表示、再押下で非表示。
 * cachedText があれば API を呼ばずにそれを表示する。
 */
export default function TranslateToggle({
  url,
  cachedText,
  locale,
  className = "",
}: {
  url: string;
  cachedText?: string | null;
  locale: Locale;
  className?: string;
}) {
  const t = translator(locale);
  const [state, setState] = useState<State>({ kind: "hidden" });

  async function toggle() {
    if (state.kind === "loading") return;
    if (state.kind === "shown") {
      setState({ kind: "hidden" });
      return;
    }
    if (cachedText) {
      setState({ kind: "shown", text: cachedText });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: { text: string } = await res.json();
      setState({ kind: "shown", text: data.text });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={state.kind === "loading"}
        className="text-xs text-orange-800 underline underline-offset-2 hover:text-orange-900 disabled:opacity-60"
      >
        {state.kind === "loading"
          ? t("detail.translating")
          : state.kind === "shown"
            ? t("detail.hideTranslation")
            : t("detail.translate")}
      </button>
      {state.kind === "error" && (
        <p className="mt-1 text-xs text-red-600">
          {t("detail.translateFailed")}
        </p>
      )}
      {state.kind === "shown" && (
        <p className="mt-1 border-l-2 border-orange-100 pl-2 text-sm text-stone-500">
          {t("detail.translated")}
          {state.text}
        </p>
      )}
    </div>
  );
}
