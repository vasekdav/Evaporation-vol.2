import O2 from '../../data/properties/O2.json';
import N2 from '../../data/properties/N2.json';
import { TableProvider, type PropertyTables } from './tableProvider';
import type { FluidId, PropertyProvider } from './types';

export * from './types';
export { TableProvider } from './tableProvider';

const TABLES: Record<FluidId, PropertyTables> = {
  O2: O2 as unknown as PropertyTables,
  N2: N2 as unknown as PropertyTables,
};

const cache = new Map<FluidId, PropertyProvider>();

/** Výchozí poskytovatel vlastností (tabulky z CoolProp 7.2.0). */
export function getProvider(fluid: FluidId): PropertyProvider {
  let p = cache.get(fluid);
  if (!p) {
    p = new TableProvider(TABLES[fluid]);
    cache.set(fluid, p);
  }
  return p;
}
