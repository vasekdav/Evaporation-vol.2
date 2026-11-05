/**
 * Jazyk textů jádra a formátování čísel (CZ / EN). Jazyk nastavuje UI (přepínač)
 * před výpočtem; výchozí je čeština. Texty se píší jako dvojice tr('česky', 'English').
 */
export type Lang = 'cs' | 'en';
export const LANGS: readonly Lang[] = ['cs', 'en'];

let current: Lang = 'cs';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang === 'en' ? 'en' : 'cs';
}

/** Vybere text podle aktuálního jazyka. */
export function tr(cs: string, en: string): string {
  return current === 'en' ? en : cs;
}
