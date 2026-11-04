/**
 * Orchestrace jednoho případu: kontroly → výkon → spotřeba → dohřev → velikost.
 * Čistá funkce: stejné vstupy dávají stejný výsledek, bez vedlejších efektů.
 */
import { findBasis, type CatalogBasis } from './catalog';
import { recommendConcept, type ConceptRecommendation } from './concept';
import { runChecks, type CheckResult, type OverallStatus, STATUS_TEXT } from './checks';
import { computeDuty, consumption, reheat, type Consumption, type DutyResult, type ReheatResult } from './duty';
import type { DesignInput } from './input';
import { getProvider } from './properties';
import { PropertyRangeError, type PropertyProvider } from './properties/types';
import { sizeBranch, type SizingResult } from './sizing';
import { toNm3h } from './units';

export type ReheatOutcome = ({ ok: true } & ReheatResult) | { ok: false; reason: string } | null;

export interface Evaluation {
  input: DesignInput;
  checks: CheckResult[];
  status: OverallStatus;
  statusText: string;
  /** Normalizované vstupy (null, pokud K1 selhalo). */
  Vn_Nm3_h: number | null;
  p_bar_a: number | null;
  T_des_C: number | null;
  duty: DutyResult | null;
  /** Spotřeba za den provozu (24 h při 24/7, jinak hoursPerDay). */
  consumptionPerDay: Consumption | null;
  reheat: ReheatOutcome;
  sizing: SizingResult | null;
  /** Doporučení konceptu (PRAXE); null, pokud jsou vstupy neplatné. */
  concept: ConceptRecommendation | null;
  /** Neočekávaná chyba dat (nemá nastat, pokud kontroly prošly). */
  error: string | null;
}

export interface EvaluateOptions {
  getProps?: (f: DesignInput['fluid']) => PropertyProvider;
  extraBases?: readonly CatalogBasis[];
}

export function evaluate(input: DesignInput, opts: EvaluateOptions = {}): Evaluation {
  const getProps = opts.getProps ?? getProvider;
  const extra = opts.extraBases ?? [];
  const c = runChecks(input, getProps, extra);
  const base: Evaluation = {
    input,
    checks: c.checks,
    status: c.status,
    statusText: c.statusText,
    Vn_Nm3_h: c.p_bar_a === null ? null : toNm3h(input.flow),
    p_bar_a: c.p_bar_a,
    T_des_C: c.T_des_C,
    duty: null,
    consumptionPerDay: null,
    reheat: null,
    sizing: null,
    concept: null,
    error: null,
  };
  if (c.status === 'INVALID' || c.p_bar_a === null || c.T_des_C === null || base.Vn_Nm3_h === null) return base;

  const props = getProps(input.fluid);
  try {
    const duty = computeDuty(props, {
      Vn_Nm3_h: base.Vn_Nm3_h,
      p_bar_a: c.p_bar_a,
      liquid: input.liquid,
      T_out_C: input.T_out_C,
    });
    base.duty = duty;
    base.consumptionPerDay = consumption(duty, input.continuous24_7 ? 24 : input.hoursPerDay);
    base.reheat = reheatOutcome(props, duty, input.T_actual_out_C);
    const basis = findBasis(input.catalogBasisId, extra)!;
    base.sizing = sizeBranch(props, duty, basis, c.T_des_C, input.k);
    base.concept = recommendConcept({
      hoursPerDay: input.hoursPerDay,
      continuous24_7: input.continuous24_7,
      frostWeeks: input.frostWeeks,
      T_des_C: c.T_des_C,
      T_out_C: input.T_out_C,
      TSL_C: input.TSL_C,
      TSL_margin_K: input.TSL_margin_K,
      availability: input.availability,
    });
  } catch (e) {
    if (!(e instanceof PropertyRangeError)) throw e;
    base.error = e.message;
    base.status = 'INVALID';
    base.statusText = STATUS_TEXT.INVALID;
    base.duty = null;
  }
  return base;
}

function reheatOutcome(props: PropertyProvider, duty: DutyResult, T_actual_C: number | null): ReheatOutcome {
  if (T_actual_C === null) return null;
  if (!(T_actual_C < duty.T_out_C))
    return { ok: false, reason: 'Očekávaná výstupní teplota bez dohřevu není nižší než návrhová – dohřev není potřeba.' };
  try {
    const r = reheat(props, duty.m_kg_s, duty.p_bar_a, T_actual_C, duty.T_out_C)!;
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof PropertyRangeError) return { ok: false, reason: e.message };
    throw e;
  }
}
