/**
 * Tepelná bilance odpařovače (kap. 5.1–5.3).
 *
 * Ustálený otevřený systém, bez práce, ΔE_kin a ΔE_pot zanedbány.
 * Tlaková ztráta zanedbána, celý výpočet při jednom absolutním tlaku p.
 *
 *   ṁ  = V̇n · ρn / 3600
 *   Q  = ṁ · (h_out − h_in)
 *   q₁ = h_l,sat(p) − h_in        ohřev kapaliny na bod varu
 *   q₂ = h_v,sat(p) − h_l,sat(p)  výparné teplo r(p)
 *   q₃ = h_out − h_v,sat(p)       přehřátí plynu
 *   Q_I = ṁ(q₁ + q₂) zóna varu, Q_II = ṁ·q₃ zóna přehřátí
 */
import type { PropertyProvider } from './properties/types';

export type LiquidInlet = { kind: 'saturated' } | { kind: 'subcooled'; T_C: number };

export interface DutyInput {
  Vn_Nm3_h: number;
  p_bar_a: number;
  liquid: LiquidInlet;
  T_out_C: number;
}

export interface DutyResult {
  Vn_Nm3_h: number;
  p_bar_a: number;
  T_out_C: number;
  rho_n_kg_Nm3: number;
  m_kg_s: number;
  m_kg_h: number;
  T_sat_C: number;
  /** Teplota kapaliny na vstupu [°C] (u nasycené = T_sat). */
  T_in_C: number;
  h_l_sat_kJ_kg: number;
  h_v_sat_kJ_kg: number;
  r_kJ_kg: number;
  h_in_kJ_kg: number;
  h_out_kJ_kg: number;
  rho_in_kg_m3: number;
  q1_kJ_kg: number;
  q2_kJ_kg: number;
  q3_kJ_kg: number;
  q_kJ_kg: number;
  Q_kW: number;
  Q_I_kW: number;
  Q_II_kW: number;
  /** Výkon pro nasycenou kapalinu při p (minimum) [kW]. */
  Q_sat_kW: number;
  /** Střední c_p kapaliny q₁/(T_sat − T_in); null pokud |T_sat − T_in| < 1 K. */
  cp_l_mean_kJ_kgK: number | null;
  /** Střední c_p plynu q₃/(T_out − T_sat). */
  cp_g_mean_kJ_kgK: number;
}

export function massFlow_kg_s(Vn_Nm3_h: number, rho_n_kg_Nm3: number): number {
  return (Vn_Nm3_h * rho_n_kg_Nm3) / 3600;
}

export function computeDuty(props: PropertyProvider, inp: DutyInput): DutyResult {
  const { Vn_Nm3_h, p_bar_a, T_out_C } = inp;
  const rho_n = props.meta.rho_n_kg_Nm3;
  const m = massFlow_kg_s(Vn_Nm3_h, rho_n);
  const sat = props.sat(p_bar_a);

  let h_in: number;
  let rho_in: number;
  let T_in_C: number;
  if (inp.liquid.kind === 'saturated') {
    h_in = sat.h_l_kJ_kg;
    rho_in = sat.rho_l_kg_m3;
    T_in_C = sat.T_sat_C;
  } else {
    const l = props.liquid(p_bar_a, inp.liquid.T_C);
    h_in = l.h_kJ_kg;
    rho_in = l.rho_kg_m3;
    T_in_C = inp.liquid.T_C;
  }
  const h_out = props.gasH(p_bar_a, T_out_C);

  const q1 = sat.h_l_kJ_kg - h_in;
  const q2 = sat.r_kJ_kg;
  const q3 = h_out - sat.h_v_kJ_kg;
  const q = q1 + q2 + q3;

  const dT_l = sat.T_sat_C - T_in_C;
  return {
    Vn_Nm3_h,
    p_bar_a,
    T_out_C,
    rho_n_kg_Nm3: rho_n,
    m_kg_s: m,
    m_kg_h: m * 3600,
    T_sat_C: sat.T_sat_C,
    T_in_C,
    h_l_sat_kJ_kg: sat.h_l_kJ_kg,
    h_v_sat_kJ_kg: sat.h_v_kJ_kg,
    r_kJ_kg: sat.r_kJ_kg,
    h_in_kJ_kg: h_in,
    h_out_kJ_kg: h_out,
    rho_in_kg_m3: rho_in,
    q1_kJ_kg: q1,
    q2_kJ_kg: q2,
    q3_kJ_kg: q3,
    q_kJ_kg: q,
    Q_kW: m * q,
    Q_I_kW: m * (q1 + q2),
    Q_II_kW: m * q3,
    Q_sat_kW: m * (q2 + q3),
    cp_l_mean_kJ_kgK: Math.abs(dT_l) >= 1 ? q1 / dT_l : null,
    cp_g_mean_kJ_kgK: q3 / (T_out_C - sat.T_sat_C),
  };
}

export interface Consumption {
  hours: number;
  mass_kg: number;
  volume_m3: number;
}

/** Spotřeba kapaliny za dobu provozu: m = ṁ·t, V = m/ρ_in. */
export function consumption(duty: DutyResult, hours: number): Consumption {
  const mass_kg = duty.m_kg_h * hours;
  return { hours, mass_kg, volume_m3: mass_kg / duty.rho_in_kg_m3 };
}

export interface ReheatResult {
  T_actual_C: number;
  T_target_C: number;
  Q_kW: number;
}

/** Výkon dohřevu: Q = ṁ·(h(p,T_out) − h(p,T_skut)), jen pro T_skut < T_out. */
export function reheat(
  props: PropertyProvider,
  m_kg_s: number,
  p_bar_a: number,
  T_actual_C: number,
  T_target_C: number,
): ReheatResult | null {
  if (!(T_actual_C < T_target_C)) return null;
  const dh = props.gasH(p_bar_a, T_target_C) - props.gasH(p_bar_a, T_actual_C);
  return { T_actual_C, T_target_C, Q_kW: m_kg_s * dh };
}
