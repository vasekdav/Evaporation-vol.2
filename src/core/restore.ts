/**
 * Bezpečné obnovení vstupů a vlastních katalogových základů z uložených dat
 * (localStorage, soubor případu, odkaz). Neznámá nebo poškozená data se zahodí.
 */
import type { CatalogBasis } from './catalog';
import { defaultInput, type DesignInput } from './input';
import { FLUID_IDS } from './properties/types';

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

