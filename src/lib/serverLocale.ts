import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./i18n";

/** サーバコンポーネントで現在の locale を読む(cookie wm.locale)。 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}
