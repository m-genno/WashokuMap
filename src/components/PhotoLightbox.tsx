"use client";

import { useEffect } from "react";
import { translator, type Locale } from "@/lib/i18n";

export interface LightboxPhoto {
  url: string;
  alt?: string;
}

/**
 * 写真の拡大表示(ライトボックス)。背景を暗くして同一ウィンドウ内に表示し、
 * 左右の矢印(ボタン/キーボード)で前後の写真へ移動できる。
 * Escape・背景クリック・✕ボタンで閉じる。
 */
export default function PhotoLightbox({
  photos,
  index,
  locale,
  onClose,
  onIndexChange,
}: {
  photos: LightboxPhoto[];
  /** 表示中の写真の添字 */
  index: number;
  locale: Locale;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const t = translator(locale);
  const count = photos.length;
  const photo = photos[index];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && count > 1) {
        onIndexChange((index - 1 + count) % count);
      } else if (e.key === "ArrowRight" && count > 1) {
        onIndexChange((index + 1) % count);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, count, onClose, onIndexChange]);

  // 表示中は背景のスクロールを止める
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!photo) return null;

  const navButtonClass =
    "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={t("lightbox.close")}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white hover:bg-black/70"
        onClick={onClose}
      >
        ✕
      </button>

      {count > 1 && (
        <button
          type="button"
          aria-label={t("lightbox.prev")}
          className={`${navButtonClass} left-3`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + count) % count);
          }}
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.alt ?? ""}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <button
          type="button"
          aria-label={t("lightbox.next")}
          className={`${navButtonClass} right-3`}
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % count);
          }}
        >
          ›
        </button>
      )}

      {count > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
          {index + 1} / {count}
        </span>
      )}
    </div>
  );
}
