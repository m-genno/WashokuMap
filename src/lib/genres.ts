import { query } from "./db";

export interface Genre {
  code: string;
  name_translations: Record<string, string>;
}

/** ジャンル一覧を seed の表示順(name_translations.ja)で返す。 */
export async function listGenres(): Promise<Genre[]> {
  return query<Genre>(
    `SELECT code, name_translations
     FROM genre
     ORDER BY name_translations->>'ja'`
  );
}
