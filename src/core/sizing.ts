/**
 * Relativní velikost – ideální dolní mez, model konstantního U (kap. 5.4).
 *
 *   T_des   = MIN(T_okolí, T_min,lokality)
 *   ΔT_I    = T_des − T_sat                  (konzervativně celá zóna I při T_sat)
 *   ΔT_out  = T_des − T_out                  (musí být > 0)
 *   LMTD_II = (ΔT_I − ΔT_out) / ln(ΔT_I/ΔT_out)   (vzduch má konstantní teplotu)
 *   UA_potř = Q_I/ΔT_I + Q_II/LMTD_II
 *   UA₁     = totéž pro 1 Nm³/h nasycené kapaliny za katalogových podmínek
 *   N_eq    = UA_potř / UA₁                   [Nm³/h katalogového základu]
 *   tepelná náročnost        = N_eq·k / V̇n
 *   nejmenší kapacita větve  = MAX(V̇n, N_eq·k)   – dolní hranice, NE doporučený model
 */
import type { CatalogBasis } from './catalog';
import { computeDuty, type DutyResult } from './duty';
import { fmt } from './format';
import type { PropertyProvider } from './properties/types';
import { toAbsBar, P_ATM_STD_BAR } from './units';

export const SIZING_WARNINGS: readonly string[] = [
  'Model předpokládá stejné U jako při katalogových podmínkách. V mrazu to neplatí: námraza pokryje celou plochu, ' +
    'chybí latentní teplo vlhkosti (při 20 °C a 75 % RH je ve vzduchu ~11 g vody/kg, při −15 °C ~1 g/kg) ' +
    'a studený vzduch se drží u jednotky. Výsledek je proto OPTIMISTICKÝ.',
  'LMTD s konstantním c_p nadhodnocuje UA_II zhruba o 1,5 %, což je na bezpečné straně.',
];

export type UAResult =
  | {
      ok: true;
      T_des_C: number;
      dT_I_K: number;
      dT_out_K: number;
      LMTD_II_K: number;
      /** UA [W/K] */
      UA_W_K: number;
      UA_I_W_K: number;
      UA_II_W_K: number;
    }
  | { ok: false; code: 'OUTLET_NOT_REACHABLE' | 'BELOW_SAT'; reason: string };

/** UA potřebné pro zóny I a II při teplotě vzduchu T_des. */
export function requiredUA(duty: Pick<DutyResult, 'Q_I_kW' | 'Q_II_kW' | 'T_sat_C' | 'T_out_C'>, T_des_C: number): UAResult {
  const dT_I = T_des_C - duty.T_sat_C;
  const dT_out = T_des_C - duty.T_out_C;
  if (!(dT_out > 0)) {
    return {
      ok: false,
      code: 'OUTLET_NOT_REACHABLE',
      reason:
        `Při teplotě vzduchu ${fmt(T_des_C, 1)} °C atmosférický odpařovač výstupní teploty ` +
        `${fmt(duty.T_out_C, 1)} °C nedosáhne (ΔT_out = ${fmt(dT_out, 1)} K ≤ 0). Posouzení velikosti nelze.`,
    };
  }
  if (!(dT_I > dT_out)) {
    return { ok: false, code: 'BELOW_SAT', reason: 'Výstupní teplota musí být nad teplotou nasycení.' };
  }
  const LMTD = (dT_I - dT_out) / Math.log(dT_I / dT_out);
  const UA_I = (duty.Q_I_kW * 1000) / dT_I;
  const UA_II = (duty.Q_II_kW * 1000) / LMTD;
  return {
    ok: true,
    T_des_C,
    dT_I_K: dT_I,
    dT_out_K: dT_out,
    LMTD_II_K: LMTD,
    UA_W_K: UA_I + UA_II,
    UA_I_W_K: UA_I,
    UA_II_W_K: UA_II,
  };
}

export type UA1Result =
  | { ok: true; p_bar_a: number; T_amb_C: number; T_out_C: number; UA1_W_K_per_Nm3h: number }
  | { ok: false; reason: string };

/**
 * UA na 1 Nm³/h za katalogových podmínek: nasycená kapalina při katalogovém tlaku,
 * T_out,kat = T_okolí,kat − přiblížení_kat. Katalogový přetlak se vztahuje
 * k normální atmosféře 1,01325 bar.
 */
export function catalogUA1(props: PropertyProvider, basis: CatalogBasis): UA1Result {
  if (basis.pressure === null || basis.approach_K === null) {
    const missing = [basis.pressure === null ? 'tlak' : null, basis.approach_K === null ? 'přiblížení' : null]
      .filter(Boolean)
      .join(' a ');
    return {
      ok: false,
      reason: `Katalogový základ „${basis.name}“ nemá uvedený ${missing}. Doplň je z podkladu výrobce, jinak UA₁ nelze spočítat.`,
    };
  }
  const p_bar_a = toAbsBar(basis.pressure, P_ATM_STD_BAR);
  const T_out_C = basis.T_amb_C - basis.approach_K;
  const d = computeDuty(props, { Vn_Nm3_h: 1, p_bar_a, liquid: { kind: 'saturated' }, T_out_C });
  const ua = requiredUA(d, basis.T_amb_C);
  if (!ua.ok) return { ok: false, reason: ua.reason };
  return { ok: true, p_bar_a, T_amb_C: basis.T_amb_C, T_out_C, UA1_W_K_per_Nm3h: ua.UA_W_K };
}

export function designAirTemp(T_amb_C: number, T_min_site_C: number | null): number {
  return T_min_site_C === null ? T_amb_C : Math.min(T_amb_C, T_min_site_C);
}

export type SizingResult =
  | {
      ok: true;
      ua: Extract<UAResult, { ok: true }>;
      ua1: Extract<UA1Result, { ok: true }>;
      basisId: string;
      /** Ideální ekvivalent [Nm³/h katalogového základu]. */
      N_eq_Nm3_h: number;
      k: number;
      /** N_eq·k / V̇n [–] */
      thermalDemand: number;
      /** MAX(V̇n, N_eq·k) – nejmenší jmenovitá kapacita větve [Nm³/h], dolní hranice. */
      minBranchCapacity_Nm3_h: number;
      warnings: readonly string[];
    }
  | { ok: false; reason: string };

export function sizeBranch(
  props: PropertyProvider,
  duty: DutyResult,
  basis: CatalogBasis,
  T_des_C: number,
  k: number,
): SizingResult {
  const ua = requiredUA(duty, T_des_C);
  if (!ua.ok) return { ok: false, reason: ua.reason };
  const ua1 = catalogUA1(props, basis);
  if (!ua1.ok) return { ok: false, reason: ua1.reason };
  const N_eq = ua.UA_W_K / ua1.UA1_W_K_per_Nm3h;
  return {
    ok: true,
    ua,
    ua1,
    basisId: basis.id,
    N_eq_Nm3_h: N_eq,
    k,
    thermalDemand: (N_eq * k) / duty.Vn_Nm3_h,
    minBranchCapacity_Nm3_h: Math.max(duty.Vn_Nm3_h, N_eq * k),
    warnings: SIZING_WARNINGS,
  };
}
