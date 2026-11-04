/**
 * Rozhraní poskytovatele vlastností látek. Implementace jsou vyměnitelné
 * (tabulky z CoolProp, v budoucnu případně CoolProp WASM).
 *
 * Referenční stav entalpie: nasycená kapalina při 1,01325 bar má h = 0.
 * Všechny entalpie v kJ/kg, tlaky v bar a, teploty v °C, hustoty v kg/m³.
 */

export type FluidId = 'O2' | 'N2' | 'Ar';

export const FLUID_IDS: readonly FluidId[] = ['O2', 'N2', 'Ar'];

export interface FluidMeta {
  fluid: FluidId;
  coolprop_name: string;
  coolprop_version: string;
  eos: string | null;
  h_reference: string;
  /** Hustota plynu při 0 °C a 1,01325 bar (reálný plyn) [kg/Nm³]. */
  rho_n_kg_Nm3: number;
  /** Normální bod varu [°C]. */
  nbp_C: number;
  /** Výparné teplo při 1,01325 bar [kJ/kg]. */
  r_atm_kJ_kg: number;
  T_triple_C: number;
  T_crit_C: number;
  p_crit_bar_a: number;
  /** Rozsah tlaku v aplikaci [bar a] (politika, ne fyzika). */
  p_min_bar_a: number;
  p_max_bar_a: number;
  /** Dolní mez tabulky kapaliny [°C] (těsně nad trojným bodem). */
  T_liq_min_C: number;
  /** Rozsah tabulky plynu [°C]. */
  T_gas_min_C: number;
  T_gas_max_C: number;
}

export interface SatState {
  p_bar_a: number;
  T_sat_C: number;
  h_l_kJ_kg: number;
  h_v_kJ_kg: number;
  /** Výparné teplo r = h_v − h_l [kJ/kg]. */
  r_kJ_kg: number;
  rho_l_kg_m3: number;
}

export interface LiquidState {
  h_kJ_kg: number;
  rho_kg_m3: number;
}

export interface PropertyProvider {
  readonly meta: FluidMeta;
  /** Nasycení při tlaku p. */
  sat(p_bar_a: number): SatState;
  /** Entalpie plynu h(p, T). */
  gasH(p_bar_a: number, T_C: number): number;
  /** Podchlazená / stlačená kapalina při (p, T), T ≤ T_sat(p). */
  liquid(p_bar_a: number, T_C: number): LiquidState;
}

export type PropertyRangeCode =
  | 'P_OUT_OF_RANGE'
  | 'T_GAS_OUT_OF_RANGE'
  | 'T_LIQ_BELOW_TABLE'
  | 'T_LIQ_ABOVE_SAT';

/** Dotaz mimo rozsah dat. Nikdy se tiše neextrapoluje. */
export class PropertyRangeError extends Error {
  constructor(
    readonly code: PropertyRangeCode,
    message: string,
    readonly details: Readonly<Record<string, number>> = {},
  ) {
    super(message);
    this.name = 'PropertyRangeError';
  }
}
