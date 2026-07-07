import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

/**
 * アップロード画像の保存バックエンド(切り替え式)。
 *
 * UPLOAD_STORAGE で選択する(未設定は local):
 *   - local    … ローカルFS。UPLOAD_DIR(既定 ./uploads)に保存する従来動作。
 *   - supabase … Supabase Storage。必要な環境変数:
 *       SUPABASE_URL(プロジェクトURL。ダッシュボード Settings → API)
 *       SUPABASE_SERVICE_ROLE_KEY(service_role キー。**秘匿必須**)
 *       SUPABASE_STORAGE_BUCKET(バケット名。省略時 "uploads"。private バケットを作成しておく)
 *
 * SDK は追加せず Storage REST API(/storage/v1)を fetch で直接呼ぶ。
 * 画像処理・名前検証・容量上限・孤立掃除は uploads.ts 側の責務で、
 * ここは「名前 → バイト列」の保存・取得・削除・一覧だけを提供する。
 */

export interface StoredObject {
  name: string;
  size: number;
  mtimeMs: number;
}

export interface UploadStorage {
  /** バックエンド識別子(ログ・容量キャッシュのキー用)。 */
  id: string;
  put(name: string, data: Buffer, mime: string): Promise<void>;
  get(name: string): Promise<Buffer | null>;
  remove(name: string): Promise<void>;
  /** 保存済みオブジェクトの一覧(容量集計・孤立掃除用)。 */
  list(): Promise<StoredObject[]>;
}

function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");
}

function localDriver(): UploadStorage {
  const dir = uploadDir();
  return {
    id: `local:${dir}`,
    async put(name, data) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), data);
    },
    async get(name) {
      try {
        return await readFile(path.join(dir, name));
      } catch {
        return null;
      }
    },
    async remove(name) {
      await unlink(path.join(dir, name));
    },
    async list() {
      let files: string[] = [];
      try {
        files = await readdir(dir);
      } catch {
        return []; // ディレクトリ未作成 = 空
      }
      const out: StoredObject[] = [];
      for (const name of files) {
        try {
          const st = await stat(path.join(dir, name));
          if (st.isFile())
            out.push({ name, size: st.size, mtimeMs: st.mtimeMs });
        } catch {
          // 走査中に消えたファイル等は無視
        }
      }
      return out;
    },
  };
}

/** Supabase Storage の list レスポンス(必要フィールドのみ)。 */
interface SupabaseListEntry {
  name: string;
  id: string | null; // フォルダ行は null
  created_at?: string;
  metadata?: { size?: number } | null;
}

function supabaseDriver(): UploadStorage {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
  if (!url || !key) {
    throw new Error(
      "UPLOAD_STORAGE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const auth = { Authorization: `Bearer ${key}` };
  const objectUrl = (name: string) =>
    `${url}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`;

  return {
    id: `supabase:${bucket}`,
    async put(name, data, mime) {
      const res = await fetch(objectUrl(name), {
        method: "POST",
        headers: { ...auth, "Content-Type": mime, "x-upsert": "false" },
        body: new Uint8Array(data),
      });
      if (!res.ok) {
        throw new Error(
          `Supabase Storage upload failed (${res.status}): ${await res.text()}`
        );
      }
    },
    async get(name) {
      const res = await fetch(objectUrl(name), { headers: auth });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(name) {
      const res = await fetch(objectUrl(name), {
        method: "DELETE",
        headers: auth,
      });
      // 既に無い(404)は削除済みとして成功扱い
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Supabase Storage delete failed (${res.status}): ${await res.text()}`
        );
      }
    },
    async list() {
      const out: StoredObject[] = [];
      const limit = 1000;
      for (let offset = 0; ; offset += limit) {
        const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            prefix: "",
            limit,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
        });
        if (!res.ok) {
          throw new Error(
            `Supabase Storage list failed (${res.status}): ${await res.text()}`
          );
        }
        const entries = (await res.json()) as SupabaseListEntry[];
        for (const e of entries) {
          if (!e.id) continue; // フォルダ行はスキップ(バケット直下のみ使う想定)
          out.push({
            name: e.name,
            size: e.metadata?.size ?? 0,
            // 作成時刻が読めない場合は「新しい」扱いにして孤立掃除の誤削除を防ぐ
            mtimeMs: e.created_at ? Date.parse(e.created_at) : Date.now(),
          });
        }
        if (entries.length < limit) break;
      }
      return out;
    },
  };
}

export type UploadBackend = "local" | "supabase";

export function uploadBackend(): UploadBackend {
  return process.env.UPLOAD_STORAGE === "supabase" ? "supabase" : "local";
}

/**
 * 環境変数から保存バックエンドを選んで返す。
 * supabase 選択時に接続情報が足りなければ throw(揮発FSへ黙って書くより早期に失敗させる)。
 */
export function uploadStorage(): UploadStorage {
  return uploadBackend() === "supabase" ? supabaseDriver() : localDriver();
}
