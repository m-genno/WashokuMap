// 操作ログ(監査)の表示用ヘルパー。一覧(AdminAuditList)と
// 詳細(AdminAuditDetail)で同じラベル・整形を使う。

export interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  detail: Record<string, unknown>;
  actor: string;
  ip: string | null;
  created_at: string;
}

export const ACTION_LABEL: Record<string, string> = {
  "restaurant.create": "店舗登録",
  "restaurant.update": "店舗編集",
  "restaurant.status": "店舗状態",
  "restaurant.import": "CSV取込",
  "reservation.status": "予約対応",
  "review.moderate": "口コミ対応",
  "uploads.cleanup": "画像整理",
};

export const ACTION_BADGE: Record<string, string> = {
  "restaurant.create": "bg-emerald-100 text-emerald-800",
  "restaurant.update": "bg-blue-100 text-blue-800",
  "restaurant.status": "bg-amber-100 text-amber-800",
  "restaurant.import": "bg-violet-100 text-violet-800",
  "reservation.status": "bg-orange-100 text-orange-800",
  "review.moderate": "bg-rose-100 text-rose-800",
  "uploads.cleanup": "bg-stone-200 text-stone-700",
};

/** 差分テーブルの項目名(changes のキー)。 */
export const FIELD_LABEL: Record<string, string> = {
  name: "店名",
  name_en: "店名(英語)",
  description: "紹介文",
  address: "住所",
  lat: "緯度",
  lng: "経度",
  phone: "電話",
  website_url: "Webサイト",
  reservation_mode: "予約方式",
  reservation_url: "予約URL",
  price_range: "価格帯",
  status: "状態",
  genres: "ジャンル",
  photos: "写真",
  hours: "営業時間",
};

/** 差分以外の detail キー(件数レポート等)の表示名。 */
export const DETAIL_KEY_LABEL: Record<string, string> = {
  status: "状態",
  geocoded: "ジオコーディング",
  total: "対象件数",
  inserted: "新規",
  updated: "更新",
  failed: "失敗",
  deleted: "削除件数",
  freedBytes: "解放容量",
  olderThanHours: "猶予(時間)",
  note: "メモ",
  from: "変更前",
  to: "変更後",
};

/** 状態などの列挙値の日本語ラベル(表示時に原値を併記)。 */
export const VALUE_LABEL: Record<string, string> = {
  draft: "下書き",
  published: "公開",
  closed: "休止",
  hidden: "非表示",
  requested: "未対応",
  counter_offer: "代替提案",
  confirmed: "確定",
  declined: "お断り",
  cancelled: "キャンセル",
  completed: "完了",
  no_show: "No-show",
  request: "リクエスト予約",
  external: "外部サイト予約",
  phone_only: "電話のみ",
};

export interface ChangeEntry {
  field: string;
  from: unknown;
  to: unknown;
}

/** detail.changes(あれば)を {field, from, to} の配列に変換。 */
export function readChanges(detail: Record<string, unknown>): ChangeEntry[] {
  const raw = detail?.changes;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, { from: unknown; to: unknown }>).map(
    ([field, ch]) => ({ field, from: ch?.from, to: ch?.to })
  );
}

/** 列挙値なら「日本語(原値)」、それ以外はそのまま文字列化。 */
export function labeledValue(s: string): string {
  const label = VALUE_LABEL[s];
  return label ? `${label}(${s})` : s;
}

/**
 * 差分の値を1行文字列の配列に整形(配列は1要素=1行)。
 * maxLen 指定時は各行を切り詰める(一覧のプレビュー用)。
 */
export function fmtValLines(v: unknown, maxLen?: number): string[] {
  let lines: string[];
  if (v === null || v === undefined || v === "") lines = ["(なし)"];
  else if (Array.isArray(v))
    lines = v.length ? v.map((x) => labeledValue(String(x))) : ["(なし)"];
  else lines = [labeledValue(String(v))];
  if (maxLen) {
    lines = lines.map((s) => (s.length > maxLen ? `${s.slice(0, maxLen)}…` : s));
  }
  return lines;
}

/** 監査対象へのリンク(店舗のみ編集画面へ)。 */
export function targetLink(r: AuditRow): string | null {
  if (r.target_type === "restaurant" && r.target_id) {
    return `/mayuchan/restaurants/${r.target_id}/edit`;
  }
  return null;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
