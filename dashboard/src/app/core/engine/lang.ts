/**
 * Display language shared by the UI and the engines' log messages.
 *
 * Plain module state (no Angular) so the engines, which are also compiled
 * standalone for the verify:* tools, can pick the right text when they write
 * a log line. Defaults to Indonesian; the Angular LanguageService sets it.
 */
export type Lang = 'id' | 'en';

let current: Lang = 'id';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}

/** Returns the text for the current language: `id` for Indonesian, `en` for English. */
export function tr(id: string, en: string): string {
  return current === 'en' ? en : id;
}
