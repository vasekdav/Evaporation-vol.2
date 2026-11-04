/**
 * Citlivost (kap. 8 bod 4): Q a N_eq vs. výstupní teplota a vs. teplota okolí,
 * absolutní vlhkost vzduchu vs. teplota. Čisté funkce nad jádrem.
 */
import type { CatalogBasis } from './catalog';
import { computeDuty, type DutyInput } from './duty';
import type { PropertyProvider } from './properties/types';
import { absoluteHumidity_g_kg } from './psychro';
import { sizeBranch } from './sizing';

export interface SensPoint {
  x: number;
  Q_kW: number | null;
  /** null = posouzení velikosti nelze (T_out ≥ T_des) */
  N_eq_Nm3_h: number | null;
}

export function range(from: number, to: number, step: number): number[] {
  const n = Math.floor((to - from) / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => Number((from + i * step).toFixed(6)));
}

function point(
  props: PropertyProvider,
  base: DutyInput,
  basis: CatalogBasis,
  T_des_C: number,
  x: number,
  T_out_C: number,
): SensPoint {
  try {
    const d = computeDuty(props, { ...base, T_out_C });
    const s = sizeBranch(props, d, basis, T_des_C, 1);
    return { x, Q_kW: d.Q_kW, N_eq_Nm3_h: s.ok ? s.N_eq_Nm3_h : null };
  } catch {
    return { x, Q_kW: null, N_eq_Nm3_h: null };
  }
}

/** Q a N_eq (k = 1) vs. výstupní teplota při pevné teplotě vzduchu T_des. */
export function sweepOutletTemp(
  props: PropertyProvider,
  base: DutyInput,
  basis: CatalogBasis,
  T_des_C: number,
  T_out_values: readonly number[] = range(props.meta.T_gas_min_C, 20, 2.5),
): SensPoint[] {
  return T_out_values.map((T) => point(props, base, basis, T_des_C, T, T));
}

/** Q a N_eq (k = 1) vs. teplota vzduchu pro posouzení, −20 až +20 °C. Q na ní nezávisí. */
export function sweepAmbientTemp(
  props: PropertyProvider,
  base: DutyInput,
  basis: CatalogBasis,
  T_amb_values: readonly number[] = range(-20, 20, 1),
): SensPoint[] {
  return T_amb_values.map((Ta) => point(props, base, basis, Ta, Ta, base.T_out_C));
}

export interface HumidityPoint {
  T_C: number;
  x_RH_g_kg: number;
  x_sat_g_kg: number;
}

/** Absolutní vlhkost při zadané RH a při nasycení (100 %), nad ledem pod 0 °C. */
export function sweepHumidity(RH_pct: number, T_values: readonly number[] = range(-20, 20, 1)): HumidityPoint[] {
  return T_values.map((T) => ({
    T_C: T,
    x_RH_g_kg: absoluteHumidity_g_kg(T, RH_pct),
    x_sat_g_kg: absoluteHumidity_g_kg(T, 100),
  }));
}
