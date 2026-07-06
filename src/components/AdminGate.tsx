"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getAdminToken, setAdminToken } from "@/lib/adminClient";

type AuthState = "idle" | "checking" | "ok" | "fail" | "error";

/**
 * /mayuchan 配下の共通ゲート。トークン欄と「認証」ボタンを表示し、
 * サーバ(GET /api/mayuchan/auth)でトークンの有効性を確認できるまで
 * ページ内容を隠す。入力中のリアルタイム判定はしない(ボタンで明示的に認証)。
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<AuthState>("idle");

  const verify = useCallback(async (token: string) => {
    if (!token.trim()) {
      setState("idle");
      return;
    }
    setState("checking");
    try {
      const res = await fetch("/api/mayuchan/auth", {
        headers: { "x-admin-token": token },
      });
      setState(res.ok ? "ok" : "fail");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // マウント後に sessionStorage を反映(SSRとの不一致回避)。
    // 保存済みトークンはサーバで再検証する(ページ間の移動で毎回ボタンを
    // 押さなくて済む。検証が通るまで内容は出さない)。
    const sync = () => {
      const token = getAdminToken();
      setValue(token);
      void verify(token);
    };
    sync();
  }, [verify]);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAdminToken(value);
          void verify(value);
        }}
        className="mb-4 flex items-end gap-2"
      >
        <label className="block flex-1">
          <span className="text-xs text-stone-500">
            運用者トークン(必須・この端末のセッションに保存)
          </span>
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setState("idle"); // 変更したら「認証」で再確認するまで内容は出さない
            }}
            placeholder="ADMIN_TOKEN の値を入力"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
        </label>
        <button
          type="submit"
          disabled={state === "checking" || !value.trim()}
          className="rounded-lg bg-orange-800 px-4 py-2 text-sm font-medium text-orange-50 hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "checking" ? "確認中…" : "認証"}
        </button>
      </form>
      {state === "ok" ? (
        children
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {state === "fail"
            ? "トークンが正しくありません。入力し直して「認証」を押してください。"
            : state === "error"
              ? "通信エラーが発生しました。もう一度「認証」を押してください。"
              : state === "checking"
                ? "トークンを確認しています…"
                : "認証が必要です。上のトークンを入力して「認証」を押してください。"}
        </p>
      )}
    </>
  );
}
