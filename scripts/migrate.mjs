#!/usr/bin/env node
// マイグレーションランナー(本番・ローカル共通)。
//
// db/migrations/*.sql を昇順に、未適用のものだけ適用し schema_migrations に記録する。
// 冪等(再実行で適用済みはスキップ)。各ファイルは1トランザクションで適用。
//
// 使い方:
//   node scripts/migrate.mjs            # 未適用を適用
//   node scripts/migrate.mjs --status   # 適用状況を表示(変更なし)
//
// 接続先は DATABASE_URL(未設定時は .env.local → ローカル既定の順で解決)。
// マネージドDBで SSL が必要な場合は DATABASE_SSL=true または URL に sslmode=require。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");
const LOCAL_DEFAULT_URL =
  "postgres://postgres:postgres@localhost:55432/washokumap";

/** DATABASE_URL を env → .env.local → ローカル既定 の順で解決。 */
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(ROOT, ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/.exec(line);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return LOCAL_DEFAULT_URL;
}

function sslOption(url) {
  if (process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function connectWithRetry(config, attempts = 30, delayMs = 1000) {
  for (let i = 1; i <= attempts; i++) {
    const client = new pg.Client(config);
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      if (i === attempts) throw err;
      if (i === 1) console.log("waiting for database…");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const url = resolveDatabaseUrl();
  const safeHost = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(unparsed)";
    }
  })();
  console.log(`migrate: target ${safeHost}`);

  const client = await connectWithRetry({
    connectionString: url,
    ssl: sslOption(url),
  });

  try {
    await client.query(
      `create table if not exists schema_migrations (
         version    text primary key,
         applied_at timestamptz not null default now()
       )`
    );

    const appliedRows = await client.query(
      `select version from schema_migrations`
    );
    const applied = new Set(appliedRows.rows.map((r) => r.version));
    const all = listMigrations();
    const pending = all.filter((v) => !applied.has(v));

    if (statusOnly) {
      console.log(`\napplied (${applied.size}):`);
      for (const v of all.filter((v) => applied.has(v))) console.log("  ✓", v);
      console.log(`\npending (${pending.length}):`);
      for (const v of pending) console.log("  •", v);
      return;
    }

    if (pending.length === 0) {
      console.log(`up to date (${applied.size} applied, 0 pending).`);
      return;
    }

    console.log(`applying ${pending.length} migration(s)…`);
    for (const version of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, version), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `insert into schema_migrations (version) values ($1)`,
          [version]
        );
        await client.query("COMMIT");
        console.log("  ✓", version);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("  ✗", version, "-", err.message);
        throw err;
      }
    }
    console.log("done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err.message);
  process.exit(1);
});
