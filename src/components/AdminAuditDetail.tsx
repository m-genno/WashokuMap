"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders } from "@/lib/adminClient";
import {
  ACTION_BADGE,
  ACTION_LABEL,
  DETAIL_KEY_LABEL,
  FIELD_LABEL,
  fmtDate,
  fmtValLines,
  readChanges,
  targetLink,
  type AuditRow,
} from "./auditPresentation";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; row: AuditRow };

/** detail の補足キー(changes 以外)を表示用に整形。 */
function fmtDetailValue(key: string, v: unknown): string {
  if (key === "freedBytes" && typeof v === "number") {
    return `${Math.round(v / 1024)}KB`;
  }
  if (typeof v === "boolean") return v ? "あり" : "なし";
  if (v === null || v === undefined || v === "") return "(なし)";
  if (typeof v === "object") return JSON.stringify(v);
  return fmtValLines(v).join(", ");
}

/**
 * 差分セルの中身。from/to が両方配列のときは行単位で比較し、
 * 削除行(変更前のみ)・追加行(変更後のみ)を色分けする。
 */
function DiffCell({
  lines,
  other,
  side,
}: {
  lines: string[];
  other: Set<string> | null;
  side: "from" | "to";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        const changed = other !== null && !other.has(line);
        const cls = !changed
          ? "text-stone-700"
          : side === "from"
            ? "rounded bg-red-50 px-1 text-red-700 line-through"
            : "rounded bg-emerald-50 px-1 text-emerald-800";
        return (
          <span key={i} className={`break-all whitespace-pre-wrap ${cls}`}>
            {line}
          </span>
        );
      })}
    </div>
  );
}

/** 操作ログ1件の詳細。変更項目ごとの変更前/変更後をテーブルで表示する。 */
export default function AdminAuditDetail({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPhase({ kind: "loading" });
      try {
        const res = await fetch(`/api/mayuchan/audit/${id}`, {
          headers: adminHeaders(),
        });
        if (cancelled) return;
        if (res.status === 401) {
          setPhase({
            kind: "error",
            message: "認証が必要です。上のトークンを入力してください。",
          });
          return;
        }
        if (res.status === 404) {
          setPhase({ kind: "error", message: "記録が見つかりません。" });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPhase({
            kind: "error",
            message: `取得に失敗しました: ${data.error ?? "unknown"}`,
          });
          return;
        }
        setPhase({ kind: "ready", row: data.entry });
      } catch {
        if (!cancelled) setPhase({ kind: "error", message: "通信エラー" });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (phase.kind === "loading") {
    return <p className="text-sm text-stone-500">読み込み中…</p>;
  }
  if (phase.kind === "error") {
    return (
      <div>
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {phase.message}
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-600 hover:border-orange-400"
        >
          再読み込み
        </button>
      </div>
    );
  }

  const r = phase.row;
  const link = targetLink(r);
  const changes = readChanges(r.detail);
  const extras = Object.entries(r.detail ?? {}).filter(
    ([k]) => k !== "changes"
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 概要 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              ACTION_BADGE[r.action] ?? "bg-stone-100 text-stone-700"
            }`}
          >
            {ACTION_LABEL[r.action] ?? r.action}
          </span>
          <span className="text-sm font-medium text-stone-800">
            {r.summary}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-stone-500">日時</dt>
          <dd className="text-stone-800">{fmtDate(r.created_at)}</dd>
          <dt className="text-stone-500">操作者</dt>
          <dd className="font-mono text-stone-800">{r.actor}</dd>
          <dt className="text-stone-500">IP</dt>
          <dd className="text-stone-800">{r.ip ?? "(記録なし)"}</dd>
          <dt className="text-stone-500">対象</dt>
          <dd>
            {link ? (
              <Link
                href={link}
                className="text-orange-800 underline hover:text-orange-900"
              >
                {r.target_type}: {r.target_id?.slice(0, 8)}… を開く →
              </Link>
            ) : r.target_id ? (
              <span className="font-mono text-stone-800">
                {r.target_type}: {r.target_id}
              </span>
            ) : (
              <span className="text-stone-500">(なし)</span>
            )}
          </dd>
        </dl>
      </section>

      {/* 変更内容(項目ごとの 変更前 → 変更後) */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          変更内容({changes.length}項目)
        </h2>
        {changes.length === 0 ? (
          <p className="text-sm text-stone-500">
            項目ごとの変更記録はありません(値の変更を伴わない操作、または旧形式の記録です)。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                  <th className="py-1.5 pr-3 font-medium">項目</th>
                  <th className="py-1.5 pr-3 font-medium">変更前</th>
                  <th className="py-1.5 font-medium">変更後</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => {
                  const fromLines = fmtValLines(c.from);
                  const toLines = fmtValLines(c.to);
                  // 両側とも配列(写真・営業時間・ジャンル等)なら行単位で追加/削除を色分け
                  const arrayDiff = Array.isArray(c.from) && Array.isArray(c.to);
                  return (
                    <tr
                      key={c.field}
                      className="border-b border-stone-100 align-top"
                    >
                      <td className="py-2 pr-3 font-medium whitespace-nowrap text-stone-600">
                        {FIELD_LABEL[c.field] ?? c.field}
                      </td>
                      <td className="py-2 pr-3">
                        {arrayDiff ? (
                          <DiffCell
                            lines={fromLines}
                            other={new Set(toLines)}
                            side="from"
                          />
                        ) : (
                          <span className="break-all whitespace-pre-wrap text-stone-500">
                            {fromLines.join("\n")}
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        {arrayDiff ? (
                          <DiffCell
                            lines={toLines}
                            other={new Set(fromLines)}
                            side="to"
                          />
                        ) : (
                          <span className="break-all whitespace-pre-wrap font-medium text-stone-800">
                            {toLines.join("\n")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 補足情報(取込件数・解放容量など changes 以外の記録) */}
      {extras.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">補足情報</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {extras.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500">{DETAIL_KEY_LABEL[k] ?? k}</dt>
                <dd className="break-all text-stone-800">
                  {fmtDetailValue(k, v)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 生データ(調査用) */}
      <details className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <summary className="cursor-pointer text-stone-600">
          記録の生データ(JSON)
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs text-stone-700">
          {JSON.stringify(r.detail, null, 2)}
        </pre>
      </details>
    </div>
  );
}
