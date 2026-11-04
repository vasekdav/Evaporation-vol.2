/** Vstupy návrhu (kap. 4) a výchozí hodnoty. */
import type { LiquidInlet } from './duty';
import { FLUID_POLICY } from './fluids';
import type { FluidId } from './properties/types';
import { P_ATM_STD_BAR, type FlowValue, type PressureValue } from './units';

export type Availability = 'N' | 'N+1' | 'backup-heater';

export interface DesignInput {
  fluid: FluidId;
  /** Špičkový návrhový průtok – zadej špičku, ne průměr. */
  flow: FlowValue;
  /** Průměrný průtok (volitelné, pro poptávku). */
  avgFlow: FlowValue | null;
  /** Provozní tlak (přetlak nebo absolutní). */
  pressure: PressureValue;
  /** Atmosférický tlak [bar a] pro převod přetlaku. */
  p_atm_bar_a: number;
  liquid: LiquidInlet;
  /** Teplota okolí pro výpočet [°C]. */
  T_amb_C: number;
  /** Minimální návrhová teplota okolí lokality [°C]; null = nezadáno. */
  T_min_site_C: number | null;
  /** Relativní vlhkost v zimě [%] – jen vysvětlující model a poptávka. */
  RH_winter_pct: number;
  /** Délka mrazového období [týdny]; null = nezadáno. */
  frostWeeks: number | null;
  /** Min. návrhová teplota navazujícího potrubí [°C] – mez křehkého lomu. */
  T_pipe_min_C: number;
  /** Návrhová výstupní teplota plynu [°C]. */
  T_out_C: number;
  /** Nastavení TSL [°C]; null = nezadáno. */
  TSL_C: number | null;
  /** Požadovaná rezerva výstupní teploty nad TSL [K]. */
  TSL_margin_K: number;
  /** Profil provozu [h/den]. */
  hoursPerDay: number;
  continuous24_7: boolean;
  availability: Availability;
  /** Očekávaná výstupní teplota bez dohřevu [°C] – pro výpočet dohřevu; null = nezadáno. */
  T_actual_out_C: number | null;
  catalogBasisId: string;
  /** Koeficient námrazy / rezervy – vstup uživatele, aplikace nenavrhuje vlastní hodnotu. */
  k: number;
}

export function defaultInput(fluid: FluidId = 'O2'): DesignInput {
  return {
    fluid,
    flow: { value: 1000, unit: 'Nm3/h' },
    avgFlow: null,
    pressure: { value: 5, kind: 'gauge' },
    p_atm_bar_a: P_ATM_STD_BAR,
    liquid: { kind: 'subcooled', T_C: FLUID_POLICY[fluid].T_in_default_C },
    T_amb_C: 0,
    T_min_site_C: null,
    RH_winter_pct: 85,
    frostWeeks: null,
    T_pipe_min_C: -30,
    T_out_C: -30,
    TSL_C: null,
    TSL_margin_K: 5,
    hoursPerDay: 8,
    continuous24_7: false,
    availability: 'N',
    T_actual_out_C: null,
    catalogBasisId: 'chart-supergap-eu',
    k: 1.0,
  };
}

/** Při změně látky přenastaví výchozí teplotu kapaliny (rozsahy a sloupec katalogu plynou z látky). */
export function withFluid(input: DesignInput, fluid: FluidId): DesignInput {
  return {
    ...input,
    fluid,
    liquid: input.liquid.kind === 'subcooled' ? { kind: 'subcooled', T_C: FLUID_POLICY[fluid].T_in_default_C } : input.liquid,
  };
}
