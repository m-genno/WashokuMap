import { query } from "./db";
import type { ReservationStatusValue } from "./reservations";
import { pickTranslation, resolveLocale } from "./i18n";

/**
 * 予約の可否が確定したときに「お客様(ゲスト)」へ送る通知。
 *
 * 店舗デスク向け通知(notifications.ts)とは逆方向で、文面はお客様の言語
 * (guest_lang)で組み立てる。機械翻訳ではなく定型テンプレートを用いる
 * (取引メールは正確さが重要で、対応言語は5つに限られるため)。
 *
 * 送信は Resend を HTTP で直接呼ぶ。未設定時はログ出力にフォールバックし、
 * いずれの場合も reservation_event に監査ログを残す。
 */

export interface GuestNotificationData {
  id: string;
  restaurantName: string;
  restaurantNameTranslations: Record<string, string> | null;
  restaurantPhone: string | null;
  desiredAt: string;
  desiredAltAt: string | null;
  partySize: number;
  guestName: string;
  guestEmail: string | null;
  guestLang: string;
}

/** お客様への通知を発生させる遷移先。これ以外(completed/no_show 等)は送らない。 */
export const GUEST_NOTIFY_STATUSES = [
  "confirmed",
  "declined",
  "counter_offer",
  "cancelled",
] as const;
export type GuestNotifyStatus = (typeof GUEST_NOTIFY_STATUSES)[number];

export function isGuestNotifyStatus(s: string): s is GuestNotifyStatus {
  return (GUEST_NOTIFY_STATUSES as readonly string[]).includes(s);
}

type TemplateLocale = "ja" | "en" | "zh-Hans" | "zh-Hant" | "ko";

const BCP47: Record<TemplateLocale, string> = {
  ja: "ja-JP",
  en: "en-US",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  ko: "ko-KR",
};

function resolveTemplateLocale(lang: string): TemplateLocale {
  if (lang in BCP47) return lang as TemplateLocale;
  return "en";
}

interface Strings {
  subject: Record<GuestNotifyStatus, string>;
  greeting: (name: string) => string;
  message: Record<GuestNotifyStatus, string>;
  labelRestaurant: string;
  labelDate: string;
  labelAlt: string;
  labelParty: string;
  partyUnit: (n: number) => string;
  labelPhone: string;
  labelRef: string;
  closing: string;
}

const STRINGS: Record<TemplateLocale, Strings> = {
  ja: {
    subject: {
      confirmed: "ご予約が確定しました",
      declined: "ご予約について",
      counter_offer: "ご予約日時のご提案",
      cancelled: "ご予約のキャンセルについて",
    },
    greeting: (name) => `${name} 様`,
    message: {
      confirmed:
        "ご予約が確定しました。下記の内容でお待ちしております。",
      declined:
        "誠に恐れ入りますが、ご希望の日時はご予約をお受けできませんでした。またのご利用を心よりお待ちしております。",
      counter_offer:
        "ご希望の日時は満席でしたが、下記の代替案でしたらご案内可能です。ご検討ください。",
      cancelled: "下記のご予約はキャンセルされました。",
    },
    labelRestaurant: "店舗",
    labelDate: "日時",
    labelAlt: "代替のご提案",
    labelParty: "人数",
    partyUnit: (n) => `${n}名`,
    labelPhone: "店舗電話",
    labelRef: "受付番号",
    closing: "WashokuMap",
  },
  en: {
    subject: {
      confirmed: "Your reservation is confirmed",
      declined: "About your reservation",
      counter_offer: "An alternative time for your reservation",
      cancelled: "Your reservation has been cancelled",
    },
    greeting: (name) => `Dear ${name},`,
    message: {
      confirmed:
        "Your reservation has been confirmed. We look forward to welcoming you with the details below.",
      declined:
        "We are very sorry, but we were unable to accept your reservation for the requested time. We hope to serve you another time.",
      counter_offer:
        "Your requested time was fully booked, but we can offer the alternative below. Please let us know if it works for you.",
      cancelled: "The reservation below has been cancelled.",
    },
    labelRestaurant: "Restaurant",
    labelDate: "Date & time",
    labelAlt: "Alternative offer",
    labelParty: "Party size",
    partyUnit: (n) => `${n} ${n === 1 ? "person" : "people"}`,
    labelPhone: "Restaurant phone",
    labelRef: "Reference",
    closing: "WashokuMap",
  },
  "zh-Hans": {
    subject: {
      confirmed: "您的预订已确认",
      declined: "关于您的预订",
      counter_offer: "为您的预订提供的替代时间",
      cancelled: "您的预订已取消",
    },
    greeting: (name) => `${name} 您好，`,
    message: {
      confirmed: "您的预订已确认。我们将按以下内容恭候您的光临。",
      declined:
        "非常抱歉，您所希望的时间无法接受预订。期待下次为您服务。",
      counter_offer:
        "您希望的时间已订满，但我们可以提供以下替代方案，敬请考虑。",
      cancelled: "以下预订已被取消。",
    },
    labelRestaurant: "店铺",
    labelDate: "日期时间",
    labelAlt: "替代方案",
    labelParty: "人数",
    partyUnit: (n) => `${n}位`,
    labelPhone: "店铺电话",
    labelRef: "受理编号",
    closing: "WashokuMap",
  },
  "zh-Hant": {
    subject: {
      confirmed: "您的預訂已確認",
      declined: "關於您的預訂",
      counter_offer: "為您的預訂提供的替代時間",
      cancelled: "您的預訂已取消",
    },
    greeting: (name) => `${name} 您好，`,
    message: {
      confirmed: "您的預訂已確認。我們將依以下內容恭候您的光臨。",
      declined:
        "非常抱歉，您所希望的時間無法接受預訂。期待下次為您服務。",
      counter_offer:
        "您希望的時間已訂滿，但我們可以提供以下替代方案，敬請考慮。",
      cancelled: "以下預訂已被取消。",
    },
    labelRestaurant: "店鋪",
    labelDate: "日期時間",
    labelAlt: "替代方案",
    labelParty: "人數",
    partyUnit: (n) => `${n}位`,
    labelPhone: "店鋪電話",
    labelRef: "受理編號",
    closing: "WashokuMap",
  },
  ko: {
    subject: {
      confirmed: "예약이 확정되었습니다",
      declined: "예약 안내",
      counter_offer: "예약 대체 일시 제안",
      cancelled: "예약이 취소되었습니다",
    },
    greeting: (name) => `${name} 님,`,
    message: {
      confirmed:
        "예약이 확정되었습니다. 아래 내용으로 기다리고 있겠습니다.",
      declined:
        "대단히 죄송하지만 요청하신 일시에는 예약을 받지 못했습니다. 다음 기회에 모실 수 있기를 바랍니다.",
      counter_offer:
        "요청하신 일시는 만석이었으나 아래 대체 일정으로는 안내가 가능합니다. 검토 부탁드립니다.",
      cancelled: "아래 예약이 취소되었습니다.",
    },
    labelRestaurant: "매장",
    labelDate: "일시",
    labelAlt: "대체 제안",
    labelParty: "인원",
    partyUnit: (n) => `${n}명`,
    labelPhone: "매장 전화",
    labelRef: "접수번호",
    closing: "WashokuMap",
  },
};

function fmtDateTime(iso: string | null, locale: TemplateLocale): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(BCP47[locale], {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** お客様向け通知メールの件名・本文を、お客様の言語で組み立てる。 */
export function buildGuestEmail(
  data: GuestNotificationData,
  status: GuestNotifyStatus
): { subject: string; text: string } {
  const locale = resolveTemplateLocale(data.guestLang);
  const s = STRINGS[locale];

  // 店舗名もお客様の言語に寄せる(訳が無ければ原文)。
  const restaurantName = pickTranslation(
    data.restaurantNameTranslations,
    resolveLocale(data.guestLang),
    data.restaurantName
  );

  const subject = `${s.subject[status]}｜${restaurantName}`;

  const lines = [
    s.greeting(data.guestName),
    "",
    s.message[status],
    "",
    `${s.labelRestaurant}: ${restaurantName}`,
    `${s.labelDate}: ${fmtDateTime(data.desiredAt, locale)}`,
  ];

  // 代替提案のときだけ代替日時を見せる(あれば)。
  if (status === "counter_offer" && data.desiredAltAt) {
    lines.push(`${s.labelAlt}: ${fmtDateTime(data.desiredAltAt, locale)}`);
  }

  lines.push(`${s.labelParty}: ${s.partyUnit(data.partySize)}`);
  if (data.restaurantPhone) {
    lines.push(`${s.labelPhone}: ${data.restaurantPhone}`);
  }
  lines.push("", `${s.labelRef}: ${data.id}`, "", "—", s.closing);

  return { subject, text: lines.join("\n") };
}

export interface GuestSendResult {
  delivered: boolean;
  provider: string;
  detail?: string;
}

/**
 * お客様へ可否通知を送信する。
 * RESEND_API_KEY / NOTIFICATION_FROM_EMAIL が設定済みかつ guestEmail がある場合に
 * Resend で送信。未設定やメール未登録ならログ出力にフォールバックする。
 */
export async function sendGuestReservationNotification(
  data: GuestNotificationData,
  status: GuestNotifyStatus
): Promise<GuestSendResult> {
  const { subject, text } = buildGuestEmail(data, status);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const to = data.guestEmail;

  if (!to) {
    console.info(
      `[guest-notification] no guest email; logging instead.\nSUBJECT: ${subject}\n${text}`
    );
    return { delivered: false, provider: "none", detail: "no_guest_email" };
  }

  if (!apiKey || !from) {
    console.info(
      `[guest-notification] provider not configured; logging instead.\nTO: ${to}\nSUBJECT: ${subject}\n${text}`
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
      console.error(
        `[guest-notification] resend failed (${res.status}): ${detail}`
      );
      return { delivered: false, provider: "resend", detail };
    }
    return { delivered: true, provider: "resend" };
  } catch (err) {
    console.error("[guest-notification] resend request error:", err);
    return { delivered: false, provider: "resend", detail: "request_error" };
  }
}

/** お客様への通知結果を reservation_event に監査ログとして残す(状態は変えない)。 */
export async function recordGuestNotificationEvent(
  reservationId: string,
  status: ReservationStatusValue,
  result: GuestSendResult
): Promise<void> {
  const note = result.delivered
    ? `お客様へ「${status}」の通知を送信しました (${result.provider})`
    : `お客様への通知は送信されませんでした (${result.detail ?? result.provider})`;
  await query(
    `INSERT INTO reservation_event
       (reservation_id, from_status, to_status, channel, actor, note)
     VALUES ($1, $2, $2, 'email', 'system', $3)`,
    [reservationId, status, note]
  );
}
