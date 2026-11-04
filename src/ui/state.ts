/**
 * Stav vstupů. localStorage jen pro pohodlí (poslední vstupy); každé čtení
 * a zápis je ošetřené a aplikace funguje i bez něj.
 */
import { useEffect, useState } from 'react';
import type { CatalogBasis } from '../core/catalog';
import { defaultInput, type DesignInput } from '../core/input';
import { FLUID_IDS } from '../core/properties/types';

export const STORAGE_KEY = 'odparovac.lastInput.v1';

/** Sloučí uložená data s výchozími; neznámá nebo poškozená data zahodí. */
export function restoreInput(raw: string | null): DesignInput {
  if (!raw) return defaultInput();
  try {
    const data = JSON.parse(raw) as Partial<DesignInput>;
    if (!data || typeof data !== 'object' || !FLUID_IDS.includes(data.fluid as never)) return defaultInput();
    const base = defaultInput(data.fluid);
    const merged = { ...base, ...data } as DesignInput;
    // JSON neumí NaN – rozepsané neplatné hodnoty se uloží jako null; povinná pole vrátíme na výchozí
    for (const key of Object.keys(base) as (keyof DesignInput)[]) {
      if (merged[key] === undefined || (merged[key] === null && base[key] !== null)) {
        (merged as unknown as Record<string, unknown>)[key] = base[key];
      }
    }
    return merged;
  } catch {
    return defaultInput();
  }
}

function load(): DesignInput {
  try {
    return restoreInput(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultInput();
  }
}

export function useDesignInput(): [DesignInput, (next: DesignInput) => void, () => void] {
  const [input, setInput] = useState<DesignInput>(load);
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

const isNumOrNull = (x: unknown) => x === null || (typeof x === 'number' && Number.isFinite(x));

/** Načte vlastní základy; neplatné položky zahodí. */
export function restoreBases(raw: string | null): CatalogBasis[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (b): b is CatalogBasis =>
        !!b &&
        typeof b === 'object' &&
        typeof b.id === 'string' &&
        b.id.startsWith('own-') &&
        typeof b.name === 'string' &&
        typeof b.T_amb_C === 'number' &&
        Number.isFinite(b.T_amb_C) &&
        isNumOrNull(b.approach_K) &&
        isNumOrNull(b.RH_pct) &&
        (b.pressure === null ||
          (typeof b.pressure === 'object' && ['gauge', 'abs'].includes(b.pressure.kind) && Number.isFinite(b.pressure.value))),
    );
  } catch {
    return [];
  }
}

export function useCustomBases(): [CatalogBasis[], (next: CatalogBasis[]) => void] {
  const [bases, setBases] = useState<CatalogBasis[]>(() => {
    try {
      return restoreBases(window.localStorage.getItem(BASES_KEY));
    } catch {
      return [];
    }
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
