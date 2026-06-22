import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";
import { query } from "./db";

/**
 * 管理操作の監査ログ。
 *
 * 認証は共有トークン(x-admin-token)で個人を特定しないため、actor は
 * トークンの不可逆ハッシュ(先頭8桁)とする。これで「同じ操作者か」は
 * 区別でき、秘密そのものは保存しない。トークン未設定(開発)は 'dev-open'。
 */

export interface AdminActor {
  actor: string;
  ip: string | null;
}

/** リクエストから操作者(トークンのハッシュ)と IP を導出する。 */
export function adminActor(req: NextRequest): AdminActor {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const token = req.headers.get("x-admin-token");
  const actor = token
    ? `admin:${createHash("sha256").update(token).digest("hex").slice(0, 8)}`
    : "dev-open";
  return { actor, ip };
}

export interface AdminAuditInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
  detail?: Record<string, unknown> | null;
  actor: AdminActor;
}

/**
 * 監査ログを1件記録する。
 * 監査の失敗が操作本体を壊さないよう、エラーは握りつぶしてログのみ残す。
 */
export async function recordAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log
         (action, target_type, target_id, summary, detail, actor, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.summary ?? null,
        JSON.stringify(input.detail ?? {}),
        input.actor.actor,
        input.actor.ip,
      ]
    );
  } catch (err) {
    console.error("[audit] failed to record:", err);
  }
}

export interface AdminAuditRow {
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

/** 監査ログ一覧(新しい順)。action 指定で絞り込み。 */
export async function listAdminAudit(opts: {
  action?: string | null;
  limit?: number;
}): Promise<AdminAuditRow[]> {
  const action = opts.action?.trim() || null;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  return query<AdminAuditRow>(
    `SELECT id, action, target_type, target_id, summary, detail, actor, ip, created_at
     FROM admin_audit_log
     WHERE ($1::text IS NULL OR action = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [action, limit]
  );
}
