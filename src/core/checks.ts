/**
 * Kontroly K1–K8 (kap. 6.1), semafor OK / INFO / POZOR / CHYBA, a doplňkové kontroly
 * D1–D4 z nezávislé odborné kontroly (úplnost, úsek před dohřevem, věrohodnost,
 * provoz vs. katalogový základ).
 *
 * NEZADÁNO = volitelný vstup chybí; NEHODNOCENO = kontrolu nelze provést, protože
 * selhala předchozí blokující kontrola. CHYBA buď blokuje výkon (K1–K6), nebo jen
 * návrh („Výkon platný, ale NÁVRH NEVYHOVUJE“).
 */
import type { CatalogBasis } from './catalog';
import { findBasis } from './catalog';
import { fmt } from './format';
import type { Availability, DesignInput } from './input';
import { FLUID_IDS, type FluidMeta, type PropertyProvider } from './properties/types';
import { designAirTemp } from './sizing';
import { FLOW_PER_NM3, toAbsBar } from './units';

export type CheckId = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8' | 'D1' | 'D2' | 'D3' | 'D4';
export type CheckLevel = 'OK' | 'INFO' | 'NEZADÁNO' | 'NEHODNOCENO' | 'POZOR' | 'CHYBA';
/** Klíč vstupu, ke kterému se nález vztahuje (pro zobrazení chyby u pole). */
export type InputField = keyof DesignInput;

export interface CheckResult {
  id: CheckId;
  title: string;
  level: CheckLevel;
  message: string;
  reference?: string;
  /** true = tento výsledek blokuje výpočet výkonu. */
  blocking: boolean;
  /** CHYBA, která neblokuje výkon, ale návrh nevyhovuje – krátký důvod pro stav výsledku. */
  designFailure?: string;
  /** Vstupy, kterých se nález týká. */
  fields?: InputField[];
}

export type OverallStatus = 'ALL_OK' | 'INCOMPLETE' | 'VALID_WITH_WARNINGS' | 'DESIGN_FAILS' | 'INVALID';

export const STATUS_TEXT: Readonly<Record<OverallStatus, string>> = {
  ALL_OK: 'Všechny kontroly OK',
  INCOMPLETE: 'Neúplné',
  VALID_WITH_WARNINGS: 'Platné – ale viz POZOR',
  DESIGN_FAILS: 'Výkon platný, ale NÁVRH NEVYHOVUJE',
  INVALID: 'NEPLATNÉ – oprav vstupy',
};

export const CHECK_TITLES: Readonly<Record<CheckId, string>> = {
  K1: 'Platné volby',
  K2: 'Tlak v rozsahu dat',
  K3: 'Výstupní teplota v rozsahu',
  K4: 'Výstupní teplota pod teplotou okolí',
  K5: 'Teplota kapaliny',
  K6: 'Křehký lom (navazující potrubí)',
  K7: 'Minimální návrhová teplota okolí lokality',
  K8: 'TSL – ochrana při nízké teplotě',
  D1: 'Úplnost návrhových údajů',
  D2: 'Úsek před dohřevem',
  D3: 'Věrohodnost vstupů a modelu',
  D4: 'Provoz vs. katalogový základ',
};

/** Kontroly, jejichž CHYBA blokuje výsledek výkonu (pokud není jen „návrhová“). */
const BLOCKING_ON_ERROR: ReadonlySet<CheckId> = new Set(['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);

const EQ_EPS = 1e-9;
/** Výchozí požadovaná rezerva nad TSL ze zadání [K]. */
export const DEFAULT_TSL_MARGIN_K = 5;
/** Pod tímto přiblížením T_des − T_out je model konstantního U mimo věrohodnost [K]. */
export const MIN_PLAUSIBLE_APPROACH_K = 3;

interface MkOpts {
  reference?: string;
  fields?: InputField[];
  designFailure?: string;
}

function mk(id: CheckId, level: CheckLevel, message: string, o: MkOpts = {}): CheckResult {
  const designOnly = o.designFailure !== undefined;
  return {
    id,
    title: CHECK_TITLES[id],
    level,
    message,
    ...(o.reference ? { reference: o.reference } : {}),
    ...(o.fields ? { fields: o.fields } : {}),
    ...(designOnly && level === 'CHYBA' ? { designFailure: o.designFailure } : {}),
    blocking: level === 'CHYBA' && BLOCKING_ON_ERROR.has(id) && !designOnly,
  };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const inRange = (x: unknown, lo: number, hi: number): boolean => isNum(x) && x >= lo && x <= hi;
const isNumOrNull = (x: unknown): boolean => x === null || isNum(x);
const AVAILABILITY: readonly Availability[] = ['N', 'N+1', 'backup-heater'];
const isFlowUnit = (u: unknown): boolean => typeof u === 'string' && Object.prototype.hasOwnProperty.call(FLOW_PER_NM3, u);

/** Mez věrohodnosti průtoku [v jednotce vstupu × přepočet] – nad ní jde téměř jistě o chybu jednotek. */
const MAX_FLOW_NM3_H = 1e6;

export function checkK1(inp: DesignInput, extraBases: readonly CatalogBasis[] = []): CheckResult {
  const errs: string[] = [];
  const fields: InputField[] = [];
  const bad = (f: InputField, label: string) => {
    errs.push(label);
    fields.push(f);
  };
  if (!FLUID_IDS.includes(inp.fluid)) bad('fluid', 'látka');
  const flowOk = !!inp.flow && isFlowUnit(inp.flow.unit) && isNum(inp.flow.value) && inp.flow.value > 0;
  if (!flowOk) bad('flow', 'špičkový průtok (> 0)');
  else if (inp.flow.value / FLOW_PER_NM3[inp.flow.unit] > MAX_FLOW_NM3_H)
    bad('flow', `špičkový průtok (nad ${fmt(MAX_FLOW_NM3_H, 0)} Nm³/h – ověř jednotky)`);
  if (inp.avgFlow !== null && (!inp.avgFlow || !isFlowUnit(inp.avgFlow.unit) || !isNum(inp.avgFlow.value) || inp.avgFlow.value < 0))
    bad('avgFlow', 'průměrný průtok');
  if (!inp.pressure || !['gauge', 'abs'].includes(inp.pressure.kind) || !isNum(inp.pressure.value))
    bad('pressure', 'provozní tlak a jeho druh (barg / bar a)');
  if (!inRange(inp.p_atm_bar_a, 0.5, 1.1)) bad('p_atm_bar_a', 'atmosférický tlak (0,5–1,1 bar a)');
  if (!inp.liquid || !['saturated', 'subcooled'].includes(inp.liquid.kind)) bad('liquid', 'stav kapaliny');
  else if (inp.liquid.kind === 'subcooled' && !isNum(inp.liquid.T_C)) bad('liquid', 'teplota kapaliny');
  if (!inRange(inp.T_amb_C, -50, 50)) bad('T_amb_C', 'teplota okolí (−50 až +50 °C)');
  if (inp.T_min_site_C !== null && !inRange(inp.T_min_site_C, -60, 30)) bad('T_min_site_C', 'minimální teplota lokality (−60 až +30 °C)');
  if (!isNum(inp.T_out_C)) bad('T_out_C', 'výstupní teplota');
  if (!inRange(inp.T_pipe_min_C, -200, 50)) bad('T_pipe_min_C', 'min. teplota potrubí (−200 až +50 °C)');
  if (!isNumOrNull(inp.TSL_C)) bad('TSL_C', 'TSL');
  if (!inRange(inp.TSL_margin_K, 0, 50)) bad('TSL_margin_K', 'rezerva nad TSL (0–50 K)');
  if (typeof inp.continuous24_7 !== 'boolean') bad('continuous24_7', 'provoz 24/7 (ano / ne)');
  if (!inRange(inp.hoursPerDay, 0, 24)) bad('hoursPerDay', 'profil provozu (0–24 h/den)');
  if (!AVAILABILITY.includes(inp.availability)) bad('availability', 'dostupnost');
  if (inp.T_actual_out_C !== null && !inRange(inp.T_actual_out_C, -60, 40))
    bad('T_actual_out_C', 'očekávaná výstupní teplota bez dohřevu (−60 až +40 °C)');
  if (inp.frostWeeks !== null && !inRange(inp.frostWeeks, 0, 52)) bad('frostWeeks', 'délka mrazového období (0–52 týdnů)');
  if (!inRange(inp.RH_winter_pct, 0, 100)) bad('RH_winter_pct', 'vlhkost (0–100 %)');
  if (typeof inp.catalogBasisId !== 'string' || !findBasis(inp.catalogBasisId, extraBases)) bad('catalogBasisId', 'katalogový základ');
  if (!inRange(inp.k, 0.01, 10)) bad('k', 'koeficient námrazy / rezervy (0–10)');
  return errs.length
    ? mk('K1', 'CHYBA', `Neplatné nebo chybějící vstupy: ${errs.join(', ')}.`, { fields })
    : mk('K1', 'OK', 'Všechny volby jsou vyplněné a platné.');
}

export function checkK2(meta: FluidMeta, p_bar_a: number): CheckResult {
  const { p_min_bar_a: lo, p_max_bar_a: hi, p_crit_bar_a: pc, fluid } = meta;
  const range = `${fmt(lo, 0)}–${fmt(hi, 0)} bar a`;
  const o = { fields: ['pressure'] as InputField[] };
  if (p_bar_a < lo) return mk('K2', 'CHYBA', `Tlak ${fmt(p_bar_a, 3)} bar a je pod rozsahem dat (${range}).`, o);
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
        o,
      );
    }
    return mk('K2', 'CHYBA', `Tlak ${fmt(p_bar_a, 2)} bar a je nad rozsahem dat (${range}).`, o);
  }
  return mk('K2', 'OK', `Tlak ${fmt(p_bar_a, 3)} bar a je v rozsahu dat (${range}).`);
}

export function checkK3(meta: FluidMeta, T_out_C: number): CheckResult {
  const lo = meta.T_gas_min_C;
  const hi = meta.T_gas_max_C;
  return T_out_C < lo || T_out_C > hi
    ? mk('K3', 'CHYBA', `Výstupní teplota ${fmt(T_out_C, 1)} °C je mimo rozsah ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`, {
        fields: ['T_out_C'],
      })
    : mk('K3', 'OK', `Výstupní teplota ${fmt(T_out_C, 1)} °C je v rozsahu ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`);
}

export function checkK4(T_out_C: number, T_amb_C: number, T_des_C: number): CheckResult {
  if (T_out_C >= T_amb_C)
    return mk(
      'K4',
      'CHYBA',
      `Výstupní teplota ${fmt(T_out_C, 1)} °C musí být nižší než teplota okolí ${fmt(T_amb_C, 1)} °C – atmosférický odpařovač teplo jen odebírá ze vzduchu.`,
      { fields: ['T_out_C', 'T_amb_C'] },
    );
  if (T_out_C >= T_des_C)
    return mk(
      'K4',
      'POZOR',
      `Při min. teplotě lokality ${fmt(T_des_C, 1)} °C nelze výstupní teploty ${fmt(T_out_C, 1)} °C dosáhnout – nutný dohřev / jiný typ + TSL. Posouzení velikosti nelze.`,
      { reference: 'AIGA 027 §5', fields: ['T_out_C', 'T_min_site_C'] },
    );
  return mk('K4', 'OK', `Výstupní teplota je ${fmt(T_des_C - T_out_C, 1)} K pod teplotou vzduchu pro posouzení (${fmt(T_des_C, 1)} °C).`);
}

export function checkK5(meta: FluidMeta, props: PropertyProvider, inp: DesignInput, p_bar_a: number): CheckResult {
  if (inp.liquid.kind === 'saturated') return mk('K5', 'OK', 'Nasycená kapalina při provozním tlaku (minimální výkon).');
  const T = inp.liquid.T_C;
  const T_sat = props.sat(p_bar_a).T_sat_C;
  const T_melt = props.meltT_C(p_bar_a);
  const o = { fields: ['liquid'] as InputField[] };
  if (T < meta.T_triple_C)
    return mk('K5', 'CHYBA', `Teplota kapaliny ${fmt(T, 1)} °C je pod trojným bodem (${fmt(meta.T_triple_C, 2)} °C) – látka by byla pevná.`, o);
  if (T < T_melt)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 2)} °C je pod křivkou tání (${fmt(T_melt, 2)} °C při ${fmt(p_bar_a, 2)} bar a) – látka by byla pevná.`,
      o,
    );
  if (T < meta.T_liq_min_C)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 1)} °C je pod dolní mezí tabulky (${fmt(meta.T_liq_min_C, 0)} °C, těsně nad trojným bodem ${fmt(meta.T_triple_C, 2)} °C).`,
      o,
    );
  if (T > T_sat + 0.01)
    return mk(
      'K5',
      'CHYBA',
      `Teplota kapaliny ${fmt(T, 2)} °C je nad teplotou nasycení ${fmt(T_sat, 2)} °C při ${fmt(p_bar_a, 3)} bar a – na vstupu by nebyla kapalina.`,
      o,
    );
  return mk('K5', 'OK', `Podchlazená kapalina ${fmt(T, 1)} °C (T_sat = ${fmt(T_sat, 2)} °C, podchlazení ${fmt(T_sat - T, 1)} K).`);
}

const LTP_NOTE = 'Ochranu proti nízké teplotě (TSL) je nutné posoudit podle AIGA 027; rozsah a SIL určí HAZOP / LOPA.';

/**
 * K6 – křehký lom. Kromě návrhové T_out hlídá i fyzikální mez: výstup atmosférického
 * odpařovače je vždy chladnější než vzduch, takže při T_des ≤ mez potrubí bude v mrazu
 * plyn pod mezí potrubí, i když je návrhová T_out nad ní.
 */
export function checkK6(T_out_C: number, T_pipe_min_C: number, T_des_C: number, T_actual_out_C: number | null): CheckResult {
  const fields: InputField[] = ['T_out_C', 'T_pipe_min_C'];
  if (T_out_C < T_pipe_min_C - EQ_EPS)
    return mk(
      'K6',
      'CHYBA',
      `Výstupní teplota ${fmt(T_out_C, 1)} °C je pod min. návrhovou teplotou navazujícího potrubí ${fmt(T_pipe_min_C, 1)} °C – riziko křehkého lomu.`,
      { reference: 'AIGA 027', fields },
    );
  if (T_des_C <= T_pipe_min_C + EQ_EPS) {
    const why =
      `Při teplotě vzduchu ${fmt(T_des_C, 1)} °C (≤ mez potrubí ${fmt(T_pipe_min_C, 1)} °C) bude výstup atmosférického ` +
      'odpařovače nutně pod mezí potrubí – plyn je vždy chladnější než vzduch.';
    if (T_actual_out_C === null)
      return mk(
        'K6',
        'CHYBA',
        `${why} Nutný dohřev s TSL za dohřevem, nebo první úsek potrubí z nerezu / nízkoteplotní oceli (nižší mez).`,
        { reference: 'AIGA 027', fields: ['T_pipe_min_C', 'T_min_site_C', 'T_actual_out_C'], designFailure: 'křehký lom' },
      );
    return mk('K6', 'POZOR', `${why} Ochrana spoléhá na dohřev – viz D2.`, { reference: 'AIGA 027', fields });
  }
  if (Math.abs(T_out_C - T_pipe_min_C) <= EQ_EPS)
    return mk('K6', 'POZOR', `Výstupní teplota je rovna mezi potrubí ${fmt(T_pipe_min_C, 1)} °C – bez rezervy.`, { reference: 'AIGA 027', fields });
  return mk('K6', 'OK', `Výstupní teplota je ${fmt(T_out_C - T_pipe_min_C, 1)} K nad mezí potrubí. ${LTP_NOTE}`, { reference: 'AIGA 027' });
}

export function checkK7(T_amb_C: number, T_min_site_C: number | null): CheckResult {
  if (T_min_site_C === null)
    return mk(
      'K7',
      'NEZADÁNO',
      `Minimální návrhová teplota okolí lokality není zadaná – velikost se posuzuje při teplotě okolí ${fmt(T_amb_C, 1)} °C a pro zimu nemusí platit. ` +
        'ČSN výpočtové teploty pro vytápění nejsou absolutní minima.',
      { reference: 'AIGA 027 §5', fields: ['T_min_site_C'] },
    );
  if (T_amb_C > T_min_site_C)
    return mk('K7', 'INFO', `Velikost posouzena při min. teplotě lokality ${fmt(T_min_site_C, 1)} °C.`, { reference: 'AIGA 027 §5' });
  return mk('K7', 'OK', `Teplota okolí pro výpočet (${fmt(T_amb_C, 1)} °C) není vyšší než minimum lokality.`, { reference: 'AIGA 027 §5' });
}

export function checkK8(T_out_C: number, T_pipe_min_C: number, TSL_C: number | null, margin_K: number): CheckResult {
  const fields: InputField[] = ['TSL_C'];
  if (TSL_C === null) return mk('K8', 'NEZADÁNO', `TSL není zadané. ${LTP_NOTE}`, { reference: 'AIGA 027', fields });
  if (TSL_C < T_pipe_min_C - EQ_EPS || T_out_C <= TSL_C + EQ_EPS) {
    const errors: string[] = [];
    if (TSL_C < T_pipe_min_C - EQ_EPS)
      errors.push(`TSL ${fmt(TSL_C, 1)} °C je pod mezí potrubí ${fmt(T_pipe_min_C, 1)} °C (AIGA 027 čl. 9.2.2.1).`);
    if (T_out_C <= TSL_C + EQ_EPS)
      errors.push(`Výstupní teplota ${fmt(T_out_C, 1)} °C není nad TSL ${fmt(TSL_C, 1)} °C – odpařovač by vypínal.`);
    return mk('K8', 'CHYBA', errors.join(' '), {
      reference: TSL_C < T_pipe_min_C - EQ_EPS ? 'AIGA 027 čl. 9.2.2.1' : 'AIGA 027',
      fields: ['TSL_C', 'T_out_C'],
      designFailure: 'TSL',
    });
  }
  if (Math.abs(TSL_C - T_pipe_min_C) <= 1e-6)
    return mk(
      'K8',
      'POZOR',
      `TSL ${fmt(TSL_C, 1)} °C je rovno mezi potrubí – bez rezervy na přesnost čidla a dobu odezvy čidla a zavření armatury.`,
      { reference: 'AIGA 027', fields },
    );
  const reserve = T_out_C - TSL_C;
  if (reserve < margin_K - EQ_EPS)
    return mk(
      'K8',
      'POZOR',
      `Rezerva výstupní teploty nad TSL je ${fmt(reserve, 1)} K, požadováno ${fmt(margin_K, 1)} K. TSL se nikdy nesnižuje kvůli častému vypínání.`,
      { reference: 'AIGA 027', fields: ['TSL_C', 'T_out_C'] },
    );
  return mk(
    'K8',
    'OK',
    `Hierarchie mez potrubí ${fmt(T_pipe_min_C, 1)} < TSL ${fmt(TSL_C, 1)} < T_out ${fmt(T_out_C, 1)} °C, rezerva ${fmt(reserve, 1)} K.`,
    { reference: 'AIGA 027' },
  );
}

/** D1 – nezadané údaje, bez kterých není návrh úplný (TSL, min. teplota lokality). */
export function checkD1(inp: DesignInput): CheckResult {
  const missing: string[] = [];
  const fields: InputField[] = [];
  if (inp.TSL_C === null) {
    missing.push('TSL');
    fields.push('TSL_C');
  }
  if (inp.T_min_site_C === null) {
    missing.push('min. teplota lokality');
    fields.push('T_min_site_C');
  }
  return missing.length
    ? mk('D1', 'NEZADÁNO', `Chybí: ${missing.join(', ')}. Bez nich nelze návrh považovat za úplný.`, { fields })
    : mk('D1', 'OK', 'TSL i minimální teplota lokality jsou zadané.');
}

/** D2 – úsek mezi odpařovačem a dohřevem (zadání 6.2). */
export function checkD2(T_out_C: number, T_pipe_min_C: number, T_actual_out_C: number | null): CheckResult {
  if (T_actual_out_C === null) return mk('D2', 'OK', 'Dohřev se neuvažuje (očekávaná T_out bez dohřevu nezadaná).');
  const rules = 'Úsek mezi odpařovačem a dohřevem z nerezu, TSL až ZA dohřevem, porucha dohřevu musí uzavřít přívod.';
  if (T_actual_out_C < T_pipe_min_C - EQ_EPS)
    return mk(
      'D2',
      'POZOR',
      `Bez dohřevu ${fmt(T_actual_out_C, 1)} °C – pod mezí potrubí ${fmt(T_pipe_min_C, 1)} °C. ${rules}`,
      { reference: 'AIGA 027', fields: ['T_actual_out_C', 'T_pipe_min_C'] },
    );
  if (T_actual_out_C < T_out_C) return mk('D2', 'INFO', `Dohřev z ${fmt(T_actual_out_C, 1)} °C na ${fmt(T_out_C, 1)} °C. ${rules}`);
  return mk('D2', 'OK', 'Očekávaná výstupní teplota bez dohřevu dosahuje návrhové – dohřev není potřeba.');
}

/** D3 – věrohodnost vstupů a mez platnosti modelu. */
export function checkD3(inp: DesignInput, T_des_C: number): CheckResult {
  const warn: string[] = [];
  const info: string[] = [];
  const fields: InputField[] = [];
  if (inp.k < 1) {
    warn.push(`k = ${fmt(inp.k, 2)} < 1 znamená „lepší než ideální model konstantního U“ – nevěrohodné.`);
    fields.push('k');
  }
  const approach = T_des_C - inp.T_out_C;
  if (approach > 0 && approach < MIN_PLAUSIBLE_APPROACH_K) {
    warn.push(
      `Přiblížení ${fmt(approach, 1)} K < ${MIN_PLAUSIBLE_APPROACH_K} K – mimo věrohodnost modelu; potřebná plocha roste neomezeně, rozhoduje výrobce.`,
    );
    fields.push('T_out_C');
  }
  if (inp.TSL_margin_K < DEFAULT_TSL_MARGIN_K) {
    info.push(`Požadovaná rezerva nad TSL ${fmt(inp.TSL_margin_K, 1)} K je menší než výchozích ${DEFAULT_TSL_MARGIN_K} K – zdůvodni v analýze rizik.`);
    fields.push('TSL_margin_K');
  }
  if (warn.length) return mk('D3', 'POZOR', [...warn, ...info].join(' '), { fields });
  if (info.length) return mk('D3', 'INFO', info.join(' '), { fields });
  return mk('D3', 'OK', 'Vstupy jsou ve věrohodném rozsahu modelu.');
}

/** D4 – profil provozu proti době provozu katalogového základu. */
export function checkD4(inp: DesignInput, T_des_C: number, basis: CatalogBasis | undefined): CheckResult {
  const rt = basis?.runtime_h ?? null;
  if (rt === null) return mk('D4', 'INFO', 'Katalogový základ neuvádí dobu provozu – vyžádej ji od výrobce.');
  const hours = inp.continuous24_7 ? 24 : inp.hoursPerDay;
  if (hours > rt && T_des_C < 0)
    return mk(
      'D4',
      'POZOR',
      `Katalogová kapacita platí pro ${fmt(rt, 0)} h provozu, profil je ${inp.continuous24_7 ? '24/7' : `${fmt(hours, 0)} h/den`}. ` +
        'V mrazu odstavená větev prakticky neodtává – vyžádej přepočet výrobce na délku cyklu a mrazové období.',
      { fields: ['hoursPerDay', 'continuous24_7'] },
    );
  return mk('D4', 'OK', `Profil provozu nepřesahuje katalogovou dobu ${fmt(rt, 0)} h, nebo není mráz.`);
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
    const rest = (['K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'D1', 'D2', 'D3', 'D4'] as CheckId[]).map((id) =>
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
    checkK6(inp.T_out_C, inp.T_pipe_min_C, T_des_C, inp.T_actual_out_C),
    checkK7(inp.T_amb_C, inp.T_min_site_C),
    checkK8(inp.T_out_C, inp.T_pipe_min_C, inp.TSL_C, inp.TSL_margin_K),
    checkD1(inp),
    checkD2(inp.T_out_C, inp.T_pipe_min_C, inp.T_actual_out_C),
    checkD3(inp, T_des_C),
    checkD4(inp, T_des_C, findBasis(inp.catalogBasisId, extraBases)),
  ];
  return finish(checks, p_bar_a, T_des_C);
}

export function overallStatus(checks: readonly CheckResult[]): OverallStatus {
  if (checks.some((c) => c.blocking)) return 'INVALID';
  if (checks.some((c) => c.level === 'CHYBA')) return 'DESIGN_FAILS';
  if (checks.some((c) => c.level === 'POZOR')) return 'VALID_WITH_WARNINGS';
  if (checks.some((c) => c.id === 'D1' && c.level === 'NEZADÁNO')) return 'INCOMPLETE';
  return 'ALL_OK';
}

/** Věta o stavu výsledku (kap. 6.1), doplněná o důvod nevyhovění a chybějící údaje. */
export function statusSentence(status: OverallStatus, checks: readonly CheckResult[]): string {
  const base = STATUS_TEXT[status];
  if (status === 'DESIGN_FAILS') {
    const why = [...new Set(checks.map((c) => c.designFailure).filter(Boolean))];
    return `${base} – ${why.join(', ')}`;
  }
  const d1 = checks.find((c) => c.id === 'D1' && c.level === 'NEZADÁNO');
  const missing = d1 ? d1.message.replace(/^Chybí: /, '').replace(/\. Bez nich.*$/, '') : '';
  if (status === 'INCOMPLETE') return `${base} – chybí: ${missing}`;
  if (status === 'VALID_WITH_WARNINGS' && missing) return `${base}; chybí: ${missing}`;
  return base;
}

function finish(checks: CheckResult[], p_bar_a: number | null, T_des_C: number | null): ChecksOutput {
  const status = overallStatus(checks);
  return { checks, status, statusText: statusSentence(status, checks), p_bar_a, T_des_C };
}
