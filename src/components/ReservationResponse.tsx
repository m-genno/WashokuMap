"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { translator, type Locale } from "@/lib/i18n";

/**
 * 代替案(counter_offer)へのお客様の回答ボタン。
 * accept → confirmed / decline → cancelled を /respond API に送り、
 * 成功したらサーバコンポーネントを再取得して最新状態を表示する。
 */
export default function ReservationResponse({
  reservationId,
  locale = "ja",
}: {
  reservationId: string;
  locale?: Locale;
}) {
  const t = translator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${reservationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "not_pending"
            ? t("resvStatus.notPending")
            : t("resvStatus.actionError")
        );
        // 状態が変わっている可能性があるため最新を反映。
        if (data.error === "not_pending") router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError(t("resvStatus.actionError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond("accept")}
          className="rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-medium text-emerald-50 hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? t("resvStatus.processing") : t("resvStatus.accept")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond("decline")}
          className="rounded-full border border-stone-300 px-6 py-2.5 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-60"
        >
          {t("resvStatus.decline")}
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
