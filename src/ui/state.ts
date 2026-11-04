/**
 * Stav vstupů. localStorage jen pro pohodlí (poslední vstupy); každé čtení
 * a zápis je ošetřené a aplikace funguje i bez něj.
 */
import { useEffect, useState } from 'react';
import type { CatalogBasis } from '../core/catalog';
import { defaultInput, type DesignInput } from '../core/input';
import { restoreBases, restoreInput } from '../core/restore';

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
