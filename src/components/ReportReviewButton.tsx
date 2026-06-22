"use client";

import { useState } from "react";
import { getAnonymousId } from "@/lib/clientStore";

type State = "idle" | "open" | "sending" | "done" | "error";

const REASONS = [
  "不適切な内容・誹謗中傷",
  "スパム・宣伝",
  "事実と異なる",
  "その他",
];

/** 口コミの通報ボタン。匿名可。理由を選んで送信する。 */
export default function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState(REASONS[0]);

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, anonymousId: getAnonymousId() }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-xs text-stone-400">通報を受け付けました</span>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className="text-xs text-stone-400 hover:text-stone-600 hover:underline"
      >
        通報
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={state === "sending"}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={state === "sending"}
        className="rounded-full bg-stone-700 px-3 py-1 text-xs font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60"
      >
        {state === "sending" ? "送信中…" : "通報する"}
      </button>
      <button
        type="button"
        onClick={() => setState("idle")}
        className="text-xs text-stone-400 hover:text-stone-600"
      >
        やめる
      </button>
      {state === "error" && (
        <span className="text-xs text-red-600">送信に失敗しました</span>
      )}
    </div>
  );
}
