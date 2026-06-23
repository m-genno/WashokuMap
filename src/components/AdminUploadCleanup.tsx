"use client";

import { useState } from "react";
import { adminHeaders } from "@/lib/adminClient";

interface Report {
  scanned: number;
  referenced: number;
  orphans: number;
  deleted: number;
  freedBytes: number;
  skippedRecent: number;
  dryRun: boolean;
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 孤立アップロード画像の確認(ドライラン)・削除。 */
export default function AdminUploadCleanup() {
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  async function run(dryRun: boolean) {
    if (!dryRun) {
      const ok = window.confirm(
        "未参照かつ猶予を過ぎた画像を完全に削除します。よろしいですか?"
      );
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/uploads/cleanup", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ dryRun, olderThanHours: hours }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401
            ? "認証が必要です。上のトークンを入力してください。"
            : `失敗しました: ${data.error ?? "unknown"}`
        );
        return;
      }
      setReport(data.report);
    } catch {
      setError("通信エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">孤立アップロード画像の掃除</h2>
      <p className="mt-1 text-sm text-stone-600">
        どの口コミ・店舗にも紐付かないアップロード画像を削除します。投稿直前の
        画像を消さないよう、指定時間より新しいファイルは保持します。
      </p>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-stone-700">猶予(時間):</span>
        <input
          type="number"
          min={0}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-orange-400"
        />
        <span className="text-stone-400">これより新しい未参照ファイルは残す</span>
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:border-orange-400 disabled:opacity-50"
        >
          {busy ? "実行中…" : "確認(削除しない)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(false)}
          className="rounded-full bg-red-700 px-4 py-2 text-sm font-medium text-red-50 hover:bg-red-800 disabled:opacity-50"
        >
          削除する
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
          <p className="font-medium text-stone-700">
            {report.dryRun ? "確認結果(未削除)" : "削除結果"}
          </p>
          <ul className="mt-1 text-stone-700">
            <li>管理対象ファイル: {report.scanned} 件</li>
            <li>参照中: {report.referenced} 件</li>
            <li className={report.orphans ? "text-amber-700" : ""}>
              孤立(対象): {report.orphans} 件 / {kb(report.freedBytes)}
            </li>
            {!report.dryRun && (
              <li className="text-emerald-700">削除済: {report.deleted} 件</li>
            )}
            <li className="text-stone-500">
              新しすぎて保持: {report.skippedRecent} 件
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
