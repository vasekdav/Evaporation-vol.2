/**
 * Jednotky a převody. Konvence pojmenování: `p_bar_a` (absolutní tlak), `p_bar_g`
 * (přetlak), `T_C` (°C), `T_K` (K), `dT_K` (rozdíl teplot), `Vn_Nm3_h` (normální
 * objemový průtok, 0 °C a 1,01325 bar), `m_kg_s`, `h_kJ_kg`, `Q_kW`.
 * °C a K se nikdy nemíchají bez explicitního převodu.
 */

export const T0_K = 273.15;
/** Normální atmosférický tlak [bar a]. */
export const P_ATM_STD_BAR = 1.01325;

export const C_to_K = (T_C: number): number => T_C + T0_K;
export const K_to_C = (T_K: number): number => T_K - T0_K;

export type PressureKind = 'gauge' | 'abs';

export interface PressureValue {
  value: number;
  kind: PressureKind;
}

/** Absolutní tlak [bar a] z přetlaku nebo absolutní hodnoty. */
export function toAbsBar(p: PressureValue, p_atm_bar_a: number = P_ATM_STD_BAR): number {
  return p.kind === 'abs' ? p.value : p.value + p_atm_bar_a;
}

/**
 * Jednotky průtoku. Převodní faktory podle zadání (kap. 4):
 * 1 Nm³ (0 °C; 1,01325 bar) = 1,0549 Sm³ (15 °C) ≈ 37,3 scf (60 °F) ≈ 38,0 scf (70 °F).
 */
export type FlowUnit = 'Nm3/h' | 'Sm3/h' | 'scfh60' | 'scfh70';

export const FLOW_PER_NM3: Readonly<Record<FlowUnit, number>> = {
  'Nm3/h': 1,
  'Sm3/h': 1.0549,
  scfh60: 37.3,
  scfh70: 38.0,
};

export interface FlowValue {
  value: number;
  unit: FlowUnit;
}

export function toNm3h(flow: FlowValue): number {
  return flow.value / FLOW_PER_NM3[flow.unit];
}

export function fromNm3h(Vn_Nm3_h: number, unit: FlowUnit): number {
  return Vn_Nm3_h * FLOW_PER_NM3[unit];
}
