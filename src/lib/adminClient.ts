"use client";

// 運用者トークンをセッション内(sessionStorage)に保持し、管理APIへ送る。
// 認証実装までの暫定。ADMIN_TOKEN 未設定の開発環境では空でも通る。

const KEY = "wm.adminToken";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(KEY) ?? "";
}

export function setAdminToken(value: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, value);
}

export function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-admin-token": token } : {}),
  };
}

/** multipart 等で Content-Type を自前指定したいとき用(トークンのみ)。 */
export function adminTokenHeader(): Record<string, string> {
  const token = getAdminToken();
  return token ? { "x-admin-token": token } : {};
}
