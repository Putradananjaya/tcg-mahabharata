import { Injectable, signal } from '@angular/core';
import { Lang, setLang } from '../engine/lang';

const LANG_KEY = 'mtcg.lang';
const LANGS: Lang[] = ['id', 'en'];

/**
 * Current display language (Indonesian / English).
 *
 * Chosen from, in order: a `?lang=en|id` URL parameter (handy for sharing an
 * English link), the choice remembered in this browser, then Indonesian.
 * Templates call `t('teks', 'text')` so each string keeps both languages side by side.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Lang>(initialLang());

  constructor() {
    this.apply(this.lang());
  }

  /** Picks the Indonesian or English text for the current language. */
  readonly t = (id: string, en: string): string => (this.lang() === 'en' ? en : id);

  isEn(): boolean {
    return this.lang() === 'en';
  }

  use(lang: Lang): void {
    if (lang === this.lang()) return;
    this.lang.set(lang);
    this.apply(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Storage may be unavailable (private mode); the choice still holds for this session.
    }
  }

  private apply(lang: Lang): void {
    setLang(lang);
    document.documentElement.lang = lang;
  }
}

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang') as Lang | null;
  if (fromUrl && LANGS.includes(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(LANG_KEY) as Lang | null;
    if (stored && LANGS.includes(stored)) return stored;
  } catch {
    // Fall through to the default.
  }
  return 'id';
}
