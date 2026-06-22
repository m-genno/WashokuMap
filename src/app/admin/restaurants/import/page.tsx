"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseCsv } from "@/lib/csv";
import { adminHeaders } from "@/lib/adminClient";
import AdminTokenField from "@/components/AdminTokenField";
import AdminRestaurantRows, {
  type RestaurantRow,
  type RestaurantRowStatus,
} from "@/components/AdminRestaurantRows";

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

type PreviewAction = "new" | "update" | "error";
interface PreviewRow {
  row: number;
  name: string;
  action: PreviewAction;
  error?: string;
  existingName?: string;
}
interface ImportPreview {
  total: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  rows: PreviewRow[];
}

const ACTION_BADGE: Record<PreviewAction, string> = {
  new: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  error: "bg-red-100 text-red-700",
};
const ACTION_LABEL: Record<PreviewAction, string> = {
  new: "新規",
  update: "更新",
  error: "失敗",
};

export default function ImportPage() {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // 取り込んだバッチの店舗(取込後にその場で確認・公開・編集できる)。
  const [batchRows, setBatchRows] = useState<RestaurantRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetFile() {
    setFilename("");
    setRows([]);
    setPreview(null);
    setResult(null);
    setBatchRows([]);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** 取込前ドライラン(新規/更新/失敗の判定)。 */
  async function runPreview(rowsToCheck: Record<string, string>[]) {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/restaurants/import/preview", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ rows: rowsToCheck }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(
          res.status === 401
            ? "認証が必要です。上のトークンを入力してください。"
            : `プレビューに失敗しました: ${data.error ?? "unknown"}`
        );
        return;
      }
      setPreview(data.preview);
    } catch {
      setParseError("通信エラー");
    } finally {
      setPreviewing(false);
    }
  }

  async function loadBatch(batchId: string) {
    try {
      const res = await fetch(
        `/api/admin/restaurants?status=all&batch=${batchId}`,
        { headers: adminHeaders() }
      );
      const data = await res.json();
      if (res.ok) setBatchRows(data.restaurants);
    } catch {
      // 取込自体は成功しているので、確認一覧の取得失敗は無視(一覧画面で確認可)。
    }
  }

  async function changeStatus(id: string, status: RestaurantRowStatus) {
    if (!result) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/restaurants/${id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) await loadBatch(result.batchId);
    } catch {
      // noop(再読み込みで整合)
    } finally {
      setBusyId(null);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setPreview(null);
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
        runPreview(parsed);
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
      await loadBatch(data.result.batchId);
    } catch {
      setParseError("通信エラー");
    } finally {
      setBusy(false);
    }
  }

  const importable = preview
    ? preview.newCount + preview.updateCount
    : rows.length;
  const previewRowsShown = preview ? preview.rows.slice(0, 100) : [];

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

        {/* 取込前の判定プレビュー(新規/更新/失敗) */}
        {rows.length > 0 && !result && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-stone-600">
              {rows.length} 行を読み込みました。
              {previewing && " 判定中…"}
            </p>

            {preview && (
              <>
                <div className="mb-2 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 font-medium text-emerald-800">
                    新規 {preview.newCount}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-0.5 font-medium text-blue-800">
                    更新 {preview.updateCount}
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-0.5 font-medium text-red-700">
                    失敗 {preview.errorCount}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-stone-100">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">行</th>
                        <th className="px-2 py-1 text-left font-medium">判定</th>
                        <th className="px-2 py-1 text-left font-medium">店名</th>
                        <th className="px-2 py-1 text-left font-medium">詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRowsShown.map((r) => (
                        <tr key={r.row} className="border-t border-stone-100">
                          <td className="px-2 py-1 text-stone-500">{r.row}</td>
                          <td className="px-2 py-1">
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${ACTION_BADGE[r.action]}`}
                            >
                              {ACTION_LABEL[r.action]}
                            </span>
                          </td>
                          <td className="px-2 py-1">{r.name || "—"}</td>
                          <td className="px-2 py-1 text-stone-500">
                            {r.action === "update"
                              ? `既存「${r.existingName}」を更新`
                              : r.action === "error"
                                ? r.error
                                : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.rows.length > previewRowsShown.length && (
                  <p className="mt-1 text-xs text-stone-400">
                    先頭 {previewRowsShown.length} 件を表示(全 {preview.rows.length} 件)
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* 投入ボタン(ファイル未選択時・取込対象が無いときは無効) */}
        {!result && (
          <button
            type="button"
            onClick={onImport}
            disabled={
              busy ||
              previewing ||
              rows.length === 0 ||
              (preview !== null && importable === 0)
            }
            className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "インポート中…"
              : previewing
                ? "判定中…"
                : rows.length === 0
                  ? "インポート(先にCSVを選択)"
                  : preview
                    ? `${importable} 件をインポート(新規${preview.newCount}/更新${preview.updateCount})`
                    : `${rows.length} 件をインポート`}
          </button>
        )}

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
              取り込んだ店舗は下書き(非公開)です。下で内容を確認し、編集・公開できます。
            </p>
          </div>
        )}

        {/* 取り込んだ店舗の確認・公開・編集(検索/編集と同じ操作) */}
        {result && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">取り込んだ店舗の確認</h2>
              <Link
                href="/admin/restaurants"
                className="text-sm text-orange-800 hover:text-orange-900"
              >
                店舗一覧で検索・編集 →
              </Link>
            </div>
            {batchRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-sm text-stone-500">
                表示できる店舗がありません(失敗のみ、または一覧の取得に失敗)。
                <Link
                  href="/admin/restaurants"
                  className="ml-1 text-orange-800 hover:text-orange-900"
                >
                  店舗一覧へ
                </Link>
              </p>
            ) : (
              <AdminRestaurantRows
                rows={batchRows}
                busyId={busyId}
                onChangeStatus={changeStatus}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
