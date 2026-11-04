/**
 * Aplikační nastavení látek (politika aplikace, ne fyzika).
 * Fyzikální konstanty (ρn, NBP, r, trojný a kritický bod) jsou v `meta`
 * vygenerovaných tabulek, viz `getProvider(fluid).meta`.
 */
import type { FluidId } from './properties/types';

export type CatalogColumn = 'LOX' | 'LIN' | 'LAR';

export interface FluidPolicy {
  id: FluidId;
  name_cs: string;
  name_en: string;
  formula: string;
  /** Výchozí teplota podchlazené kapaliny – návrhový případ [°C]. */
  T_in_default_C: number;
  /** Sloupec katalogu výrobce pro tuto látku. */
  catalogColumn: CatalogColumn;
  /** Označení kapaliny ve spotřebě. */
  liquidLabel: string;
}

export const FLUID_POLICY: Readonly<Record<FluidId, FluidPolicy>> = {
  O2: {
    id: 'O2',
    name_cs: 'kyslík',
    name_en: 'oxygen',
    formula: 'O₂',
    T_in_default_C: -183,
    catalogColumn: 'LOX',
    liquidLabel: 'LOX',
  },
  N2: {
    id: 'N2',
    name_cs: 'dusík',
    name_en: 'nitrogen',
    formula: 'N₂',
    T_in_default_C: -196,
    catalogColumn: 'LIN',
    liquidLabel: 'LIN',
  },
  // Fáze 5. Rozsah 1–40 bar a (kritický tlak 48,63 bar), dolní mez kapaliny −189 °C (trojný bod −189,34 °C).
  Ar: {
    id: 'Ar',
    name_cs: 'argon',
    name_en: 'argon',
    formula: 'Ar',
    T_in_default_C: -186,
    catalogColumn: 'LAR',
    liquidLabel: 'LAR',
  },
};
