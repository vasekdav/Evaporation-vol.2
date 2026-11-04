/**
 * Kontroly K1–K8 (kap. 6.1), semafor OK / INFO / POZOR / CHYBA.
 * NEZADÁNO = volitelný vstup chybí; NEHODNOCENO = kontrolu nelze provést,
 * protože selhala předchozí blokující kontrola.
 */
import type { CatalogBasis } from './catalog';
import { findBasis } from './catalog';
import { fmt } from './format';
import type { Availability, DesignInput } from './input';
import { FLUID_IDS, type FluidMeta, type PropertyProvider } from './properties/types';
import { designAirTemp } from './sizing';
import { FLOW_PER_NM3, toAbsBar } from './units';

export type CheckId = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8';
export type CheckLevel = 'OK' | 'INFO' | 'NEZADÁNO' | 'NEHODNOCENO' | 'POZOR' | 'CHYBA';

export interface CheckResult {
  id: CheckId;
  title: string;
  level: CheckLevel;
  message: string;
  reference?: string;
  /** true = tento výsledek blokuje výpočet výkonu. */
  blocking: boolean;
}

export type OverallStatus = 'ALL_OK' | 'VALID_WITH_WARNINGS' | 'DESIGN_FAILS_TSL' | 'INVALID';

export const STATUS_TEXT: Readonly<Record<OverallStatus, string>> = {
  ALL_OK: 'Všechny kontroly OK',
  VALID_WITH_WARNINGS: 'Platné – ale viz POZOR',
  DESIGN_FAILS_TSL: 'Výkon platný, ale NÁVRH NEVYHOVUJE – TSL',
  INVALID: 'NEPLATNÉ – oprav vstupy',
};

export const CHECK_TITLES: Readonly<Record<CheckId, string>> = {
  K1: 'Platné volby',
  K2: 'Tlak v rozsahu dat',
  K3: 'Výstupní teplota v rozsahu',
  K4: 'Výstupní teplota pod teplotou okolí',
  K5: 'Teplota kapaliny',
  K6: 'Křehký lom (navazující potrubí)',
  K7: 'Minimální teplota lokality',
  K8: 'TSL – ochrana při nízké teplotě',
};

/** Kontroly, jejichž CHYBA blokuje výsledek výkonu. K8 výkon neblokuje. */
const BLOCKING_ON_ERROR: ReadonlySet<CheckId> = new Set(['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);

const EQ_EPS = 1e-9;

function mk(id: CheckId, level: CheckLevel, message: string, reference?: string): CheckResult {
  return {
    id,
    title: CHECK_TITLES[id],
    level,
    message,
    ...(reference ? { reference } : {}),
    blocking: level === 'CHYBA' && BLOCKING_ON_ERROR.has(id),
  };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isNumOrNull = (x: unknown): boolean => x === null || isNum(x);
const AVAILABILITY: readonly Availability[] = ['N', 'N+1', 'backup-heater'];

export function checkK1(inp: DesignInput, extraBases: readonly CatalogBasis[] = []): CheckResult {
  const errs: string[] = [];
  if (!FLUID_IDS.includes(inp.fluid)) errs.push('látka');
  if (!inp.flow || !(inp.flow.unit in FLOW_PER_NM3) || !isNum(inp.flow.value) || !(inp.flow.value > 0))
    errs.push('špičkový průtok (> 0)');
  if (inp.avgFlow !== null && (!(inp.avgFlow.unit in FLOW_PER_NM3) || !isNum(inp.avgFlow.value) || inp.avgFlow.value < 0))
    errs.push('průměrný průtok');
  if (!inp.pressure || !['gauge', 'abs'].includes(inp.pressure.kind) || !isNum(inp.pressure.value))
    errs.push('provozní tlak a jeho druh (barg / bar a)');
  if (!isNum(inp.p_atm_bar_a) || !(inp.p_atm_bar_a > 0)) errs.push('atmosférický tlak');
  if (!inp.liquid || !['saturated', 'subcooled'].includes(inp.liquid.kind)) errs.push('stav kapaliny');
  else if (inp.liquid.kind === 'subcooled' && !isNum(inp.liquid.T_C)) errs.push('teplota kapaliny');
  if (!isNum(inp.T_amb_C)) errs.push('teplota okolí');
  if (!isNumOrNull(inp.T_min_site_C)) errs.push('minimální teplota lokality');
  if (!isNum(inp.T_out_C)) errs.push('výstupní teplota');
  if (!isNum(inp.T_pipe_min_C)) errs.push('min. teplota potrubí');
  if (!isNumOrNull(inp.TSL_C)) errs.push('TSL');
  if (!isNum(inp.TSL_margin_K) || inp.TSL_margin_K < 0) errs.push('rezerva nad TSL (≥ 0 K)');
  if (!isNum(inp.hoursPerDay) || inp.hoursPerDay < 0 || inp.hoursPerDay > 24) errs.push('profil provozu (0–24 h/den)');
  if (!AVAILABILITY.includes(inp.availability)) errs.push('dostupnost');
  if (!isNumOrNull(inp.T_actual_out_C)) errs.push('očekávaná výstupní teplota bez dohřevu');
  if (!isNumOrNull(inp.frostWeeks)) errs.push('délka mrazového období');
  if (!isNum(inp.RH_winter_pct) || inp.RH_winter_pct < 0 || inp.RH_winter_pct > 100) errs.push('vlhkost (0–100 %)');
  if (!findBasis(inp.catalogBasisId, extraBases)) errs.push('katalogový základ');
  if (!isNum(inp.k) || !(inp.k > 0)) errs.push('koeficient námrazy / rezervy (> 0)');
  return errs.length
    ? mk('K1', 'CHYBA', `Neplatné nebo chybějící vstupy: ${errs.join(', ')}.`)
    : mk('K1', 'OK', 'Všechny volby jsou vyplněné a platné.');
}

export function checkK2(meta: FluidMeta, p_bar_a: number): CheckResult {
  const { p_min_bar_a: lo, p_max_bar_a: hi, p_crit_bar_a: pc, fluid } = meta;
  const range = `${fmt(lo, 0)}–${fmt(hi, 0)} bar a`;
  if (p_bar_a < lo) return mk('K2', 'CHYBA', `Tlak ${fmt(p_bar_a, 3)} bar a je pod rozsahem dat (${range}).`);
  if (p_bar_a > hi) {
    if (fluid === 'N2') {
      const why =
        p_bar_a >= pc
          ? `Tlak ${fmt(p_bar_a, 2)} bar a je nad kritickým tlakem dusíku (${fmt(pc, 2)} bar a), mimo rozsah.`
          : `Tlak ${fmt(p_bar_a, 2)} bar a je blízko kritického tlaku dusíku (${fmt(pc, 2)} bar a), mimo rozsah fáze 1 (max. ${fmt(hi, 0)} bar a).`;
      return mk(
        'K2',
        'CHYBA',
        `${why} Nad kritickým tlakem kapalina nevře, rozklad na var a přehřátí ani model dvou zón neplatí. ` +
          'Nadkritický režim (vysokotlaké dusíkové odpařovače nad 34 bar) je samostatná úloha mimo rozsah.',
      );
    }
    return mk('K2', 'CHYBA', `Tlak ${fmt(p_bar_a, 2)} bar a je nad rozsahem dat (${range}).`);
  }
  return mk('K2', 'OK', `Tlak ${fmt(p_bar_a, 3)} bar a je v rozsahu dat (${range}).`);
}

export function checkK3(meta: FluidMeta, T_out_C: number): CheckResult {
  const lo = meta.T_gas_min_C;
  const hi = meta.T_gas_max_C;
  return T_out_C < lo || T_out_C > hi
    ? mk('K3', 'CHYBA', `Výstupní teplota ${fmt(T_out_C, 1)} °C je mimo rozsah ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`)
    : mk('K3', 'OK', `Výstupní teplota ${fmt(T_out_C, 1)} °C je v rozsahu ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`);
}

export function checkK4(T_out_C: number, T_amb_C: number, T_des_C: number): CheckResult {
  if (T_out_C >= T_amb_C)
    return mk(
      'K4',
      'CHYBA',
      `Výstupní teplota ${fmt(T_out_C, 1)} °C musí být nižší než teplota okolí ${fmt(T_amb_C, 1)} °C – atmosférický odpařovač teplo jen odebírá ze vzduchu.`,
    );
  if (T_out_C >= T_des_C)
    return mk(
      'K4',
      'POZOR',
      `Při min. teplotě lokality ${fmt(T_des_C, 1)} °C nelze výstupní teploty ${fmt(T_out_C, 1)} °C dosáhnout – nutný dohřev / jiný typ + TSL. Posouzení velikosti nelze.`,
      'AIGA 027 §5',
    );
  return mk('K4', 'OK', `Výstupní teplota je ${fmt(T_des_C - T_out_C, 1)} K pod teplotou vzduchu pro posouzení (${fmt(T_des_C, 1)} °C).`);
}

export function checkK5(meta: FluidMeta, props: PropertyProvider, inp: DesignInput, p_bar_a: number): CheckResult {
  if (inp.liquid.kind === 'saturated')
    return mk('K5', 'OK', 'Nasycená kapalina při provozním tlaku (minimální výkon).');
  const T = inp.liquid.T_C;
  const T_sat = props.sat(p_bar_a).T_sat_C;
  if (T < meta.T_triple_C)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 1)} °C je pod trojným bodem (${fmt(meta.T_triple_C, 2)} °C) – látka by byla pevná.`,
    );
  if (T < meta.T_liq_min_C)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 1)} °C je pod dolní mezí tabulky (${fmt(meta.T_liq_min_C, 0)} °C, těsně nad trojným bodem ${fmt(meta.T_triple_C, 2)} °C).`,
    );
  if (T > T_sat + 0.01)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 2)} °C je nad teplotou nasycení ${fmt(T_sat, 2)} °C při ${fmt(p_bar_a, 3)} bar a – na vstupu by nebyla kapalina.`,
    );
  return mk('K5', 'OK', `Podchlazená kapalina ${fmt(T, 1)} °C (T_sat = ${fmt(T_sat, 2)} °C, podchlazení ${fmt(T_sat - T, 1)} K).`);
}

export function checkK6(T_out_C: number, T_pipe_min_C: number): CheckResult {
  if (T_out_C < T_pipe_min_C - EQ_EPS)
    return mk(
      'K6',
      'CHYBA',
      `Výstupní teplota ${fmt(T_out_C, 1)} °C je pod min. návrhovou teplotou navazujícího potrubí ${fmt(T_pipe_min_C, 1)} °C – riziko křehkého lomu.`,
      'AIGA 027',
    );
  if (Math.abs(T_out_C - T_pipe_min_C) <= EQ_EPS)
    return mk('K6', 'POZOR', `Výstupní teplota je rovna mezi potrubí ${fmt(T_pipe_min_C, 1)} °C – bez rezervy.`, 'AIGA 027');
  return mk(
    'K6',
    'OK',
    `Výstupní teplota je ${fmt(T_out_C - T_pipe_min_C, 1)} K nad mezí potrubí. TSL doporučuje AIGA 027.`,
    'AIGA 027',
  );
}

export function checkK7(T_amb_C: number, T_min_site_C: number | null): CheckResult {
  if (T_min_site_C === null)
    return mk(
      'K7',
      'NEZADÁNO',
      'Minimální návrhová teplota lokality není zadaná – velikost se posuzuje při zadané teplotě okolí. ČSN výpočtové teploty pro vytápění nejsou absolutní minima.',
      'AIGA 027 §5',
    );
  if (T_amb_C > T_min_site_C)
    return mk('K7', 'INFO', `Velikost posouzena při min. teplotě lokality ${fmt(T_min_site_C, 1)} °C.`, 'AIGA 027 §5');
  return mk('K7', 'OK', `Teplota okolí pro výpočet (${fmt(T_amb_C, 1)} °C) není vyšší než minimum lokality.`, 'AIGA 027 §5');
}

export function checkK8(T_out_C: number, T_pipe_min_C: number, TSL_C: number | null, margin_K: number): CheckResult {
  if (TSL_C === null)
    return mk('K8', 'NEZADÁNO', 'TSL není zadané. Ochranu při nízké teplotě doporučuje AIGA 027.', 'AIGA 027');
  const errors: string[] = [];
  if (TSL_C < T_pipe_min_C - EQ_EPS)
    errors.push(`TSL ${fmt(TSL_C, 1)} °C je pod mezí potrubí ${fmt(T_pipe_min_C, 1)} °C (AIGA 027 čl. 9.2.2.1).`);
  if (T_out_C <= TSL_C + EQ_EPS)
    errors.push(`Výstupní teplota ${fmt(T_out_C, 1)} °C není nad TSL ${fmt(TSL_C, 1)} °C – odpařovač by vypínal.`);
  if (errors.length) return mk('K8', 'CHYBA', errors.join(' '), 'AIGA 027 čl. 9.2.2.1');
  const reserve = T_out_C - TSL_C;
  if (reserve < margin_K - EQ_EPS)
    return mk(
      'K8',
      'POZOR',
      `Rezerva výstupní teploty nad TSL je ${fmt(reserve, 1)} K, požadováno ${fmt(margin_K, 1)} K. TSL se nikdy nesnižuje kvůli častému vypínání.`,
      'AIGA 027',
    );
  return mk(
    'K8',
    'OK',
    `Hierarchie mez potrubí ${fmt(T_pipe_min_C, 1)} < TSL ${fmt(TSL_C, 1)} < T_out ${fmt(T_out_C, 1)} °C, rezerva ${fmt(reserve, 1)} K.`,
    'AIGA 027',
  );
}

const notEvaluated = (id: CheckId, why: string): CheckResult => mk(id, 'NEHODNOCENO', why);

export interface ChecksOutput {
  checks: CheckResult[];
  status: OverallStatus;
  statusText: string;
  p_bar_a: number | null;
  T_des_C: number | null;
}

export function runChecks(
  inp: DesignInput,
  getProps: (f: DesignInput['fluid']) => PropertyProvider,
  extraBases: readonly CatalogBasis[] = [],
): ChecksOutput {
  const k1 = checkK1(inp, extraBases);
  if (k1.level === 'CHYBA') {
    const rest = (['K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'] as CheckId[]).map((id) =>
      notEvaluated(id, 'Nehodnoceno – nejdřív oprav K1.'),
    );
    return finish([k1, ...rest], null, null);
  }
  const props = getProps(inp.fluid);
  const meta = props.meta;
  const p_bar_a = toAbsBar(inp.pressure, inp.p_atm_bar_a);
  const T_des_C = designAirTemp(inp.T_amb_C, inp.T_min_site_C);
  const k2 = checkK2(meta, p_bar_a);
  const k5 = k2.level === 'CHYBA' ? notEvaluated('K5', 'Nehodnoceno – tlak mimo rozsah (K2).') : checkK5(meta, props, inp, p_bar_a);
  const checks = [
    k1,
    k2,
    checkK3(meta, inp.T_out_C),
    checkK4(inp.T_out_C, inp.T_amb_C, T_des_C),
    k5,
    checkK6(inp.T_out_C, inp.T_pipe_min_C),
    checkK7(inp.T_amb_C, inp.T_min_site_C),
    checkK8(inp.T_out_C, inp.T_pipe_min_C, inp.TSL_C, inp.TSL_margin_K),
  ];
  return finish(checks, p_bar_a, T_des_C);
}

export function overallStatus(checks: readonly CheckResult[]): OverallStatus {
  if (checks.some((c) => c.blocking)) return 'INVALID';
  if (checks.some((c) => c.id === 'K8' && c.level === 'CHYBA')) return 'DESIGN_FAILS_TSL';
  if (checks.some((c) => c.level === 'POZOR')) return 'VALID_WITH_WARNINGS';
  return 'ALL_OK';
}

function finish(checks: CheckResult[], p_bar_a: number | null, T_des_C: number | null): ChecksOutput {
  const status = overallStatus(checks);
  return { checks, status, statusText: STATUS_TEXT[status], p_bar_a, T_des_C };
}
