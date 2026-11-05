/**
 * Stav vstupů. localStorage jen pro pohodlí (poslední vstupy); každé čtení
 * a zápis je ošetřené a aplikace funguje i bez něj.
 */
import { useEffect, useState } from 'react';
import type { CatalogBasis } from '../core/catalog';
import { defaultInput, type DesignInput } from '../core/input';
import { restoreBases, restoreInput } from '../core/restore';
import { setLang as setCoreLang, type Lang } from '../core/i18n';

export { restoreBases, restoreInput };

export const STORAGE_KEY = 'odparovac.lastInput.v1';

function load(): DesignInput {
  try {
    return restoreInput(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultInput();
  }
}

export function useDesignInput(initial?: DesignInput): [DesignInput, (next: DesignInput) => void, () => void] {
  const [input, setInput] = useState<DesignInput>(() => initial ?? load());
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* úložiště nedostupné (soukromé okno, blokované) – nevadí */
    }
  }, [input]);
  return [input, setInput, () => setInput(defaultInput(input.fluid))];
}

// ------------------------------------------------------------ vlastní katalogové základy
export const BASES_KEY = 'odparovac.customBases.v1';

export function useCustomBases(extra?: CatalogBasis | null): [CatalogBasis[], (next: CatalogBasis[]) => void] {
  const [bases, setBases] = useState<CatalogBasis[]>(() => {
    let stored: CatalogBasis[] = [];
    try {
      stored = restoreBases(window.localStorage.getItem(BASES_KEY));
    } catch {
      stored = [];
    }
    // základ z načteného případu nahradí uložený se stejným id
    return extra ? [...stored.filter((b) => b.id !== extra.id), extra] : stored;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(BASES_KEY, JSON.stringify(bases));
    } catch {
      /* úložiště nedostupné – vlastní základy platí jen do zavření stránky */
    }
  }, [bases]);
  return [bases, setBases];
}

// ------------------------------------------------------------ úpravy poptávky
export const INQUIRY_KEY = 'odparovac.inquiry.v1';

export function restoreInquiry(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function useInquiry(initial?: Record<string, string>): [Record<string, string>, (next: Record<string, string>) => void] {
  const [inq, setInq] = useState<Record<string, string>>(() => {
    if (initial) return initial;
    try {
      return restoreInquiry(window.localStorage.getItem(INQUIRY_KEY));
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(INQUIRY_KEY, JSON.stringify(inq));
    } catch {
      /* úložiště nedostupné – nevadí */
    }
  }, [inq]);
  return [inq, setInq];
}

// ------------------------------------------------------------ jazyk a barevný režim
export const LANG_KEY = 'odparovac.lang.v1';
export const THEME_KEY = 'odparovac.theme.v1';
export type Theme = 'light' | 'dark';

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* úložiště nedostupné – nevadí */
  }
}

/** Jazyk UI: uložená volba, jinak podle prohlížeče (čeština / slovenština → CZ, jinak EN). */
export function initialLang(): Lang {
  const saved = readPref(LANG_KEY);
  if (saved === 'cs' || saved === 'en') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'cs';
  return nav.startsWith('cs') || nav.startsWith('sk') ? 'cs' : 'en';
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang();
    setCoreLang(l);
    return l;
  });
  const set = (l: Lang) => {
    setCoreLang(l); // jádro musí znát jazyk dřív, než se překreslí
    writePref(LANG_KEY, l);
    setLangState(l);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return [lang, set];
}

/** Barevný režim: uložená volba, jinak systémové nastavení. */
export function initialTheme(): Theme {
  const saved = readPref(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = initialTheme();
    document.documentElement.dataset.theme = t; // hned, ať se stránka nepřebarví až po prvním vykreslení
    return t;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const set = (t: Theme) => {
    writePref(THEME_KEY, t);
    setThemeState(t);
  };
  return [theme, set];
}
