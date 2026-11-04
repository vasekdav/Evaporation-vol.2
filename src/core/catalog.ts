/**
 * Katalogové základy a modely výrobců. Vše je ÚDAJ VÝROBCE, ilustrativní
 * a editovatelné. Aplikace nikdy nevybírá model závazně.
 */
import basesJson from '../data/catalog/bases.json';
import modelsJson from '../data/catalog/models.json';
import type { CatalogColumn } from './fluids';
import type { PressureValue } from './units';

export interface CatalogBasis {
  id: string;
  name: string;
  manufacturer: string;
  T_amb_C: number;
  RH_pct: number | null;
  /** Katalogový tlak; přetlak je vztažen k 1,01325 bar. null = neuveden. */
  pressure: PressureValue | null;
  /** Přiblížení výstupní teploty k okolí [K]; null = neuvedeno. */
  approach_K: number | null;
  runtime_h: number | null;
  wind_m_s: number | null;
  hpLinedFactor: number | null;
  note: string;
  source: string;
  modelsId: string | null;
}

export interface CatalogModel {
  model: string;
  LOX: number;
  LIN: number;
  area_m2: number;
  height_m: number;
}

export interface CatalogModelSet {
  id: string;
  basisId: string;
  source: string;
  models: CatalogModel[];
}

export const CATALOG_BASES: readonly CatalogBasis[] = basesJson.bases as CatalogBasis[];
export const CATALOG_MODEL_SETS: readonly CatalogModelSet[] = modelsJson.sets as CatalogModelSet[];

export const ILLUSTRATION_TITLE = 'Ilustrace z katalogu – výběr a garance výrobce';

export function findBasis(id: string, extra: readonly CatalogBasis[] = []): CatalogBasis | undefined {
  return [...extra, ...CATALOG_BASES].find((b) => b.id === id);
}

export interface ModelAbove {
  model: string;
  capacity_Nm3_h: number;
  column: CatalogColumn;
}

/**
 * Modely, jejichž katalogová kapacita (sloupec dané látky) je ≥ nejmenší
 * kapacitě větve. Jen ilustrace, vždy pod nadpisem ILLUSTRATION_TITLE.
 */
export function modelsAtOrAbove(
  set: CatalogModelSet,
  column: CatalogColumn,
  minCapacity_Nm3_h: number,
): ModelAbove[] {
  return set.models
    .filter((m) => m[column] >= minCapacity_Nm3_h)
    .map((m) => ({ model: m.model, capacity_Nm3_h: m[column], column }));
}
