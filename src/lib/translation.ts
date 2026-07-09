/**
 * テキスト翻訳。
 *
 * DeepL を利用する。依存を増やさないため HTTP API を直接呼び出す。
 *   - DEEPL_API_KEY 未設定 → null(翻訳未接続)
 *   - source と target が同じ → 翻訳不要なので原文をそのまま返す
 *   - それ以外 → DeepL で翻訳。失敗時は null
 *
 * エンドポイントは無料キー(":fx" で終わる)を自動判別。
 * DEEPL_API_URL を設定すると上書きできる(プロキシ/テスト用)。
 */

/** アプリのロケール → DeepL の target_lang。未対応ロケールは undefined。 */
const DEEPL_TARGET_LANG: Record<string, string> = {
  ja: "JA",
  en: "EN-US",
  "zh-Hans": "ZH-HANS",
  "zh-Hant": "ZH-HANT",
  ko: "KO",
};

/**
 * テキストを targetLocale(アプリのロケールコード)へ翻訳する。
 * sourceLang が targetLocale と同じなら原文をそのまま返す。
 * 未接続・未対応ロケール・失敗時は null。
 */
export async function translateText(
  text: string | null | undefined,
  targetLocale: string,
  sourceLang?: string
): Promise<string | null> {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  if (sourceLang === targetLocale) return trimmed; // 翻訳不要

  const targetLang = DEEPL_TARGET_LANG[targetLocale];
  if (!targetLang) return null; // 未対応ロケール

  const key = process.env.DEEPL_API_KEY;
  if (!key) return null; // 翻訳未接続

  const endpoint =
    process.env.DEEPL_API_URL ??
    (key.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      // source_lang は省略し DeepL の自動判定に任せる。
      body: JSON.stringify({ text: [trimmed], target_lang: targetLang }),
    });
    if (!res.ok) {
      console.error(`[translation] deepl failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as {
      translations?: { text?: string }[];
    };
    return data.translations?.[0]?.text ?? null;
  } catch (err) {
    console.error("[translation] deepl request error:", err);
    return null;
  }
}

/** 日本語への翻訳(店舗向けキャッシュ用の従来ヘルパ)。 */
export async function translateToJa(
  text: string | null | undefined,
  sourceLang?: string
): Promise<string | null> {
  return translateText(text, "ja", sourceLang);
}
