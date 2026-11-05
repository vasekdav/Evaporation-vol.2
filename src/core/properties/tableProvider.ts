/**
 * PropertyProvider nad předpočítanými tabulkami z CoolProp (tools/gen_tables.py).
 *
 * - Nasycení: 1D tabulka podle tlaku, lineární interpolace.
 * - Plyn: h(p, T), bilineární interpolace.
 * - Kapalina: h_l(T, Δp) a ρ_l(T, Δp), kde Δp = p − p_sat(T) ≥ 0, bilineární
 *   interpolace; p_sat(T) se interpoluje lineárně v ln p.
 *   Při Δp = 0 jde o nasycenou kapalinu, tabulka je tedy obecnou formou korekce
 *   h_l(p,T) = h_l,sat(T) + (∂h/∂p)_T·(p − p_sat(T)).
 */
import { fmt } from '../format';
import { bracket, interp1, interp2, lerpAt } from './interp';
import {
  PropertyRangeError,
  type FluidMeta,
  type LiquidState,
  type PropertyProvider,
  type SatState,
} from './types';

export interface PropertyTables {
  meta: FluidMeta;
  sat: {
    p_bar_a: number[];
    T_C: number[];
    h_l: number[];
    h_v: number[];
    rho_l: number[];
    /** křivka tání (CoolProp melting_line) */
    T_melt_C: number[];
  };
  gas: {
    p_bar_a: number[];
    T_C: number[];
    /** h[i][j] pro p_bar_a[i], T_C[j] */
    h: number[][];
  };
  liquid: {
    T_C: number[];
    dp_bar: number[];
    p_sat_bar_a: number[];
    /** h[i][j] pro T_C[i], dp_bar[j] */
    h: number[][];
    rho: number[][];
  };
}

/** Tolerance, se kterou se kapalina „na saturaci“ ještě přijme jako nasycená [K]. */
const SAT_T_TOL_K = 0.01;

export class TableProvider implements PropertyProvider {
  readonly meta: FluidMeta;
  private readonly lnPsat: number[];

  constructor(private readonly t: PropertyTables) {
    this.meta = t.meta;
    this.lnPsat = t.liquid.p_sat_bar_a.map(Math.log);
  }

  private checkP(p_bar_a: number): void {
    const { p_min_bar_a: lo, p_max_bar_a: hi, fluid } = this.meta;
    if (!(p_bar_a >= lo - 1e-9 && p_bar_a <= hi + 1e-9)) {
      throw new PropertyRangeError(
        'P_OUT_OF_RANGE',
        `Tlak ${fmt(p_bar_a, 3)} bar a je mimo rozsah dat pro ${fluid} (${fmt(lo, 0)}–${fmt(hi, 0)} bar a).`,
        { p_bar_a, p_min_bar_a: lo, p_max_bar_a: hi },
      );
    }
  }

  sat(p_bar_a: number): SatState {
    this.checkP(p_bar_a);
    const s = this.t.sat;
    const br = bracket(s.p_bar_a, p_bar_a)!;
    const h_l = lerpAt(s.h_l, br);
    const h_v = lerpAt(s.h_v, br);
    return {
      p_bar_a,
      T_sat_C: lerpAt(s.T_C, br),
      h_l_kJ_kg: h_l,
      h_v_kJ_kg: h_v,
      r_kJ_kg: h_v - h_l,
      rho_l_kg_m3: lerpAt(s.rho_l, br),
    };
  }

  meltT_C(p_bar_a: number): number {
    this.checkP(p_bar_a);
    return lerpAt(this.t.sat.T_melt_C, bracket(this.t.sat.p_bar_a, p_bar_a)!);
  }

  gasH(p_bar_a: number, T_C: number): number {
    this.checkP(p_bar_a);
    const g = this.t.gas;
    const h = interp2(g.p_bar_a, g.T_C, g.h, p_bar_a, T_C);
    if (h === null) {
      throw new PropertyRangeError(
        'T_GAS_OUT_OF_RANGE',
        `Teplota plynu ${fmt(T_C, 2)} °C je mimo rozsah tabulky (${fmt(this.meta.T_gas_min_C, 0)} až +${fmt(this.meta.T_gas_max_C, 0)} °C).`,
        { T_C, T_min_C: this.meta.T_gas_min_C, T_max_C: this.meta.T_gas_max_C },
      );
    }
    return h;
  }

  /** p_sat(T) [bar a] z tabulky kapaliny (interpolace v ln p). */
  pSatOfT(T_C: number): number | null {
    const v = interp1(this.t.liquid.T_C, this.lnPsat, T_C);
    return v === null ? null : Math.exp(v);
  }

  liquid(p_bar_a: number, T_C: number): LiquidState {
    this.checkP(p_bar_a);
    const L = this.t.liquid;
    if (T_C < this.meta.T_liq_min_C - 1e-9) {
      throw new PropertyRangeError(
        'T_LIQ_BELOW_TABLE',
        `Teplota kapaliny ${fmt(T_C, 2)} °C je pod dolní mezí tabulky ${fmt(this.meta.T_liq_min_C, 0)} °C ` +
          `(trojný bod ${fmt(this.meta.T_triple_C, 2)} °C).`,
        { T_C, T_min_C: this.meta.T_liq_min_C },
      );
    }
    const sat = this.sat(p_bar_a);
    if (T_C > sat.T_sat_C + SAT_T_TOL_K) {
      throw new PropertyRangeError(
        'T_LIQ_ABOVE_SAT',
        `Teplota kapaliny ${fmt(T_C, 2)} °C je nad teplotou nasycení ${fmt(sat.T_sat_C, 2)} °C při ${fmt(p_bar_a, 3)} bar a.`,
        { T_C, T_sat_C: sat.T_sat_C },
      );
    }
    if (T_C >= sat.T_sat_C) {
      return { h_kJ_kg: sat.h_l_kJ_kg, rho_kg_m3: sat.rho_l_kg_m3 };
    }
    const ps = this.pSatOfT(T_C);
    if (ps === null) {
      // Nemá nastat: tabulka kapaliny pokrývá T_liq_min … T_sat(p_max).
      throw new PropertyRangeError('T_LIQ_BELOW_TABLE', `Teplota kapaliny ${fmt(T_C, 2)} °C mimo tabulku kapaliny.`, {
        T_C,
      });
    }
    const dp = Math.max(0, p_bar_a - ps);
    const h = interp2(L.T_C, L.dp_bar, L.h, T_C, dp);
    const rho = interp2(L.T_C, L.dp_bar, L.rho, T_C, dp);
    if (h === null || rho === null) {
      throw new PropertyRangeError('T_LIQ_BELOW_TABLE', `Stav kapaliny mimo tabulku (T = ${fmt(T_C, 2)} °C, Δp = ${fmt(dp, 3)} bar).`, {
        T_C,
        dp,
      });
    }
    return { h_kJ_kg: h, rho_kg_m3: rho };
  }
}
