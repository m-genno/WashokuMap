"use client";

/**
 * 一覧のページング共通部品(1始まり)。
 * 総件数と1ページ件数からページ数を計算し、表示範囲・前へ/次へ・
 * ページ番号(先頭/末尾と現在ページ±1、間は「…」)を表示する。
 * 1ページに収まる場合も表示範囲がわかるよう描画する(0件のときのみ非表示)。
 */
export default function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  disabled = false,
  prevLabel = "← 前へ",
  nextLabel = "次へ →",
  rangeLabel = defaultRangeLabel,
  className = "",
}: {
  /** 現在のページ(1始まり) */
  page: number;
  /** 1ページの件数 */
  perPage: number;
  /** 総件数 */
  total: number;
  onPageChange: (page: number) => void;
  /** 読み込み中などに操作を止める */
  disabled?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  /** 表示範囲の文言(i18nが必要な画面は差し替える) */
  rangeLabel?: (start: number, end: number, total: number) => string;
  className?: string;
}) {
  if (total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * perPage + 1;
  const end = Math.min(current * perPage, total);

  const pageBtnBase =
    "min-w-8 rounded-lg border px-2 py-1 text-sm transition-colors disabled:opacity-40";
  const pageBtnOff =
    "border-stone-300 bg-white text-stone-700 hover:border-orange-400";
  const pageBtnOn = "border-orange-800 bg-orange-800 font-medium text-orange-50";

  return (
    <nav
      aria-label="ページ切り替え"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}
    >
      <span className="text-xs text-stone-500">
        {rangeLabel(start, end, total)}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={disabled || current <= 1}
          onClick={() => onPageChange(current - 1)}
          className={`${pageBtnBase} ${pageBtnOff}`}
        >
          {prevLabel}
        </button>
        {pageItems(current, totalPages).map((item, i) =>
          item === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-stone-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={disabled}
              aria-current={item === current ? "page" : undefined}
              onClick={() => item !== current && onPageChange(item)}
              className={`${pageBtnBase} ${
                item === current ? pageBtnOn : pageBtnOff
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={disabled || current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          className={`${pageBtnBase} ${pageBtnOff}`}
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}

function defaultRangeLabel(start: number, end: number, total: number): string {
  return `全 ${total} 件中 ${start}–${end} 件`;
}

/** 表示するページ番号列(先頭/末尾+現在±1、飛びは「…」)。 */
function pageItems(current: number, totalPages: number): (number | "…")[] {
  const wanted = new Set(
    [1, current - 1, current, current + 1, totalPages].filter(
      (p) => p >= 1 && p <= totalPages
    )
  );
  const items: (number | "…")[] = [];
  let prev = 0;
  for (const p of [...wanted].sort((a, b) => a - b)) {
    if (prev && p - prev > 1) items.push("…");
    items.push(p);
    prev = p;
  }
  return items;
}
