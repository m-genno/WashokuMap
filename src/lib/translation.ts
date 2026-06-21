/**
 * テキスト翻訳(現状は日本語への翻訳のみ使用)。
 *
 * DeepL を利用する。依存を増やさないため HTTP API を直接呼び出す。
 *   - DEEPL_API_KEY 未設定 → null(翻訳未接続)
 *   - source が 'ja' → 翻訳不要なので原文をそのまま返す
 *   - それ以外 → DeepL で日本語へ翻訳。失敗時は null
 *
 * エンドポイントは無料キー(":fx" で終わる)を自動判別。
 * DEEPL_API_URL を設定すると上書きできる(プロキシ/テスト用)。
 */
export async function translateToJa(
  text: string | null | undefined,
  sourceLang?: string
): Promise<string | null> {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  if (sourceLang === "ja") return trimmed; // すでに日本語

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
      body: JSON.stringify({ text: [trimmed], target_lang: "JA" }),
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
