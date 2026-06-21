import { Pool, type QueryResultRow } from "pg";

/**
 * PostgreSQL 接続プール。
 * 開発時は HMR で何度も評価されるため、グローバルに保持して接続枯渇を防ぐ。
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

/** パラメータ化クエリを実行して行配列を返す薄いヘルパー。 */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
