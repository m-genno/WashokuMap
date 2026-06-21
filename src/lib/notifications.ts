import { query } from "./db";

export interface ReservationNotificationData {
  id: string;
  restaurantName: string;
  restaurantPhone: string | null;
  desiredAt: string;
  desiredAltAt: string | null;
  partySize: number;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestLang: string;
  /** 要望(原文) */
  requests: string | null;
  /** 要望(日本語訳)。翻訳API未接続時は ja 入力のみ埋まる */
  requestsJa: string | null;
  dietary: Record<string, unknown> | null;
  budgetPerPerson: number | null;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "(なし)";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDietary(d: Record<string, unknown> | null): string {
  if (!d) return "(指定なし)";
  const parts: string[] = [];
  if (d.vegetarian) parts.push("ベジタリアン対応希望");
  if (d.halal) parts.push("ハラル対応希望");
  if (typeof d.religion === "string" && d.religion) {
    parts.push(`宗教上の制限: ${d.religion}`);
  }
  const allergies = Array.isArray(d.allergies) ? d.allergies : [];
  if (allergies.length > 0) parts.push(`アレルギー: ${allergies.join(", ")}`);
  return parts.length > 0 ? parts.join(" / ") : "(指定なし)";
}

/**
 * 店舗/予約デスク向けの通知メール文面を組み立てる。
 * 要望は「日本語訳」と「原文」を必ず併記する(設計の中核)。
 */
export function buildReservationEmail(d: ReservationNotificationData): {
  subject: string;
  text: string;
} {
  const subject = `【予約リクエスト】${d.restaurantName} / ${fmtDateTime(
    d.desiredAt
  )} / ${d.partySize}名`;

  const langName =
    {
      en: "English",
      ja: "日本語",
      "zh-Hans": "简体中文",
      "zh-Hant": "繁體中文",
      ko: "한국어",
    }[d.guestLang] ?? d.guestLang;

  const lines = [
    "新しい予約リクエストが届きました。内容を確認し、店舗へ可否をご確認ください。",
    "",
    `■ 店舗: ${d.restaurantName}` +
      (d.restaurantPhone ? ` (TEL: ${d.restaurantPhone})` : ""),
    `■ 希望日時: ${fmtDateTime(d.desiredAt)}`,
    `■ 代替希望: ${fmtDateTime(d.desiredAltAt)}`,
    `■ 人数: ${d.partySize}名`,
    `■ お名前: ${d.guestName}`,
    `■ 連絡先: ${d.guestEmail ?? "-"} / ${d.guestPhone ?? "-"}`,
    `■ 利用言語: ${langName}`,
    `■ 予算: ${
      d.budgetPerPerson != null ? `${d.budgetPerPerson}円/人` : "(指定なし)"
    }`,
    "",
    "【ご要望(日本語訳)】",
    d.requestsJa ?? "(翻訳未接続 / not translated)",
    "",
    `【ご要望(原文 / ${langName})】`,
    d.requests ?? "(なし)",
    "",
    "【食事の制限】",
    formatDietary(d.dietary),
    "",
    `■ 受付番号: ${d.id}`,
  ];

  return { subject, text: lines.join("\n") };
}

export interface SendResult {
  delivered: boolean;
  provider: string;
  detail?: string;
}

/**
 * 予約通知を送信する。
 * RESEND_API_KEY / NOTIFICATION_FROM_EMAIL / RESERVATION_DESK_EMAIL が
 * すべて設定されていれば Resend で送信、未設定ならログ出力にフォールバックする。
 * 依存を増やさないため Resend は HTTP API を直接叩く。
 */
export async function sendReservationNotification(
  data: ReservationNotificationData
): Promise<SendResult> {
  const { subject, text } = buildReservationEmail(data);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const to = process.env.RESERVATION_DESK_EMAIL;

  if (!apiKey || !from || !to) {
    console.info(
      `[notification] provider not configured; logging instead.\nSUBJECT: ${subject}\n${text}`
    );
    return {
      delivered: false,
      provider: "none",
      detail: "provider_not_configured",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[notification] resend failed (${res.status}): ${detail}`);
      return { delivered: false, provider: "resend", detail };
    }
    return { delivered: true, provider: "resend" };
  } catch (err) {
    console.error("[notification] resend request error:", err);
    return { delivered: false, provider: "resend", detail: "request_error" };
  }
}

/** 通知の結果を reservation_event に監査ログとして残す(状態は変えない)。 */
export async function recordNotificationEvent(
  reservationId: string,
  result: SendResult
): Promise<void> {
  const note = result.delivered
    ? `店舗/予約デスクへ通知を送信しました (${result.provider})`
    : `通知は送信されませんでした (${result.detail ?? result.provider})`;
  await query(
    `INSERT INTO reservation_event
       (reservation_id, from_status, to_status, channel, actor, note)
     VALUES ($1, 'requested', 'requested', 'email', 'system', $2)`,
    [reservationId, note]
  );
}
