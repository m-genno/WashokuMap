"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseCsv } from "@/lib/csv";
import { adminHeaders } from "@/lib/adminClient";
import AdminTokenField from "@/components/AdminTokenField";

const COLUMNS = [
  "name",
  "name_en",
  "address",
  "phone",
  "website_url",
  "genres",
  "reservation_mode",
  "reservation_url",
  "price_range",
];

interface ImportResult {
  batchId: string;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: { row: number; error: string }[];
}

export default function ImportPage() {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetFile() {
    setFilename("");
    setRows([]);
    setResult(null);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setParseError("");
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        if (parsed.length === 0) {
          setParseError("データ行がありません。");
          setRows([]);
          return;
        }
        if (!("name" in parsed[0])) {
          setParseError("ヘッダに name 列がありません。");
          setRows([]);
          return;
        }
        setRows(parsed);
      } catch {
        setParseError("CSVの解析に失敗しました。");
        setRows([]);
      }
    };
    reader.readAsText(file);
  }

  async function onImport() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/restaurants/import", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ filename, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(`インポート失敗: ${data.error ?? "unknown"}`);
        return;
      }
      setResult(data.result);
    } catch {
      setParseError("通信エラー");
    } finally {
      setBusy(false);
    }
  }

  const preview = rows.slice(0, 10);

  return (
    <div className="flex flex-1 flex-col bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-semibold">
            管理
          </Link>
          <span className="text-stone-400">/</span>
          <span className="text-stone-600">CSVインポート</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <AdminTokenField />
        </div>

        <p className="mb-2 text-sm text-stone-600">
          列(先頭行ヘッダ): <code className="text-xs">{COLUMNS.join(", ")}</code>
          。<code>name</code> と <code>address</code> 推奨、
          <code>genres</code> は <code>;</code> 区切りのコード(例:{" "}
          <code>sushi;izakaya</code>)。重複(電話 or 店名+住所)は更新します。
        </p>

        {/* ファイルアップロード部品(明示ボタン。ロード時に自動でダイアログは開かない) */}
        <div className="mb-4 rounded-2xl border border-dashed border-stone-300 bg-white p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-stone-300 bg-stone-50 px-5 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              CSVファイルを選択
            </button>
            <span className="text-sm text-stone-600">
              {filename ? filename : "ファイルが選択されていません"}
            </span>
            {filename && (
              <button
                type="button"
                onClick={resetFile}
                className="text-xs text-stone-500 underline hover:text-stone-700"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {parseError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {parseError}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <p className="mb-2 text-sm text-stone-600">
              {rows.length} 行を読み込みました(先頭{preview.length}件をプレビュー)
            </p>
            <div className="mb-3 overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full text-xs">
                <thead className="bg-stone-100">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c} className="px-2 py-1 text-left font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      {COLUMNS.map((c) => (
                        <td key={c} className="px-2 py-1">
                          {r[c] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 投入ボタン(ファイル未選択時は無効) */}
        <button
          type="button"
          onClick={onImport}
          disabled={busy || rows.length === 0}
          className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "インポート中…"
            : rows.length > 0
              ? `${rows.length} 件をインポート`
              : "インポート(先にCSVを選択)"}
        </button>

        {result && (
          <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold">インポート結果</h2>
            <ul className="text-stone-700">
              <li>対象: {result.total} 件</li>
              <li className="text-emerald-700">新規: {result.inserted} 件</li>
              <li className="text-blue-700">更新: {result.updated} 件</li>
              <li className="text-red-700">失敗: {result.failed} 件</li>
            </ul>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-stone-700">失敗した行:</p>
                <ul className="list-disc pl-5 text-red-700">
                  {result.errors.map((er) => (
                    <li key={er.row}>
                      {er.row} 行目: {er.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-xs text-stone-500">
              取り込んだ店舗は下書き(非公開)です。内容確認後に公開してください。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
