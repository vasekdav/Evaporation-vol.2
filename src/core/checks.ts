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
import { tr } from './i18n';
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
  /** D1: chybějící údaje (pro větu o stavu) */
  missing?: string[];
}

export type OverallStatus = 'ALL_OK' | 'INCOMPLETE' | 'VALID_WITH_WARNINGS' | 'DESIGN_FAILS' | 'INVALID';

/** Zobrazovaný název úrovně semaforu (interní hodnoty zůstávají česky). */
export function levelText(l: CheckLevel): string {
  const m: Record<CheckLevel, [string, string]> = {
    OK: ['OK', 'OK'],
    INFO: ['INFO', 'INFO'],
    NEZADÁNO: ['NEZADÁNO', 'NOT SET'],
    NEHODNOCENO: ['NEHODNOCENO', 'NOT EVALUATED'],
    POZOR: ['POZOR', 'WARNING'],
    CHYBA: ['CHYBA', 'ERROR'],
  };
  return tr(m[l][0], m[l][1]);
}

/** Věta o stavu (kap. 6.1) v aktuálním jazyce. */
export function statusBase(s: OverallStatus): string {
  switch (s) {
    case 'ALL_OK':
      return tr('Všechny kontroly OK', 'All checks OK');
    case 'INCOMPLETE':
      return tr('Neúplné', 'Incomplete');
    case 'VALID_WITH_WARNINGS':
      return tr('Platné – ale viz POZOR', 'Valid – but see WARNING');
    case 'DESIGN_FAILS':
      return tr('Výkon platný, ale NÁVRH NEVYHOVUJE', 'Duty valid, but DESIGN FAILS');
    case 'INVALID':
      return tr('NEPLATNÉ – oprav vstupy', 'INVALID – correct the inputs');
  }
}

/** Kompatibilita: věta o stavu v aktuálním jazyce. */
export const STATUS_TEXT: Readonly<Record<OverallStatus, string>> = new Proxy({} as Record<OverallStatus, string>, {
  get: (_t, k) => statusBase(k as OverallStatus),
});

export function checkTitle(id: CheckId): string {
  const t: Record<CheckId, [string, string]> = {
    K1: ['Platné volby', 'Valid selections'],
    K2: ['Tlak v rozsahu dat', 'Pressure within data range'],
    K3: ['Výstupní teplota v rozsahu', 'Outlet temperature within range'],
    K4: ['Výstupní teplota pod teplotou okolí', 'Outlet temperature below ambient'],
    K5: ['Teplota kapaliny', 'Liquid temperature'],
    K6: ['Křehký lom (navazující potrubí)', 'Brittle fracture (downstream piping)'],
    K7: ['Minimální návrhová teplota okolí lokality', 'Minimum design ambient temperature of the site'],
    K8: ['TSL – ochrana při nízké teplotě', 'TSL – low-temperature protection'],
    D1: ['Úplnost návrhových údajů', 'Completeness of design data'],
    D2: ['Úsek před dohřevem', 'Section upstream of the trim heater'],
    D3: ['Věrohodnost vstupů a modelu', 'Plausibility of inputs and model'],
    D4: ['Provoz vs. katalogový základ', 'Operation vs. catalogue basis'],
  };
  return tr(t[id][0], t[id][1]);
}

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
  missing?: string[];
}

function mk(id: CheckId, level: CheckLevel, message: string, o: MkOpts = {}): CheckResult {
  const designOnly = o.designFailure !== undefined;
  return {
    id,
    title: checkTitle(id),
    level,
    message,
    ...(o.reference ? { reference: o.reference } : {}),
    ...(o.fields ? { fields: o.fields } : {}),
    ...(o.missing ? { missing: o.missing } : {}),
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
  if (!FLUID_IDS.includes(inp.fluid)) bad('fluid', tr('látka', 'fluid'));
  const flowOk = !!inp.flow && isFlowUnit(inp.flow.unit) && isNum(inp.flow.value) && inp.flow.value > 0;
  if (!flowOk) bad('flow', tr('špičkový průtok (> 0)', 'peak flow (> 0)'));
  else if (inp.flow.value / FLOW_PER_NM3[inp.flow.unit] > MAX_FLOW_NM3_H)
    bad('flow', tr(`špičkový průtok (nad ${fmt(MAX_FLOW_NM3_H, 0)} Nm³/h – ověř jednotky)`, `peak flow (above ${fmt(MAX_FLOW_NM3_H, 0)} Nm³/h – check units)`));
  if (inp.avgFlow !== null && (!inp.avgFlow || !isFlowUnit(inp.avgFlow.unit) || !isNum(inp.avgFlow.value) || inp.avgFlow.value < 0))
    bad('avgFlow', tr('průměrný průtok', 'average flow'));
  if (!inp.pressure || !['gauge', 'abs'].includes(inp.pressure.kind) || !isNum(inp.pressure.value))
    bad('pressure', tr('provozní tlak a jeho druh (barg / bar a)', 'operating pressure and its type (barg / bar a)'));
  if (!inRange(inp.p_atm_bar_a, 0.5, 1.1)) bad('p_atm_bar_a', tr('atmosférický tlak (0,5–1,1 bar a)', 'atmospheric pressure (0.5–1.1 bar a)'));
  if (!inp.liquid || !['saturated', 'subcooled'].includes(inp.liquid.kind)) bad('liquid', tr('stav kapaliny', 'liquid state'));
  else if (inp.liquid.kind === 'subcooled' && !isNum(inp.liquid.T_C)) bad('liquid', tr('teplota kapaliny', 'liquid temperature'));
  if (!inRange(inp.T_amb_C, -50, 50)) bad('T_amb_C', tr('teplota okolí (−50 až +50 °C)', 'ambient temperature (−50 to +50 °C)'));
  if (inp.T_min_site_C !== null && !inRange(inp.T_min_site_C, -60, 30)) bad('T_min_site_C', tr('minimální teplota lokality (−60 až +30 °C)', 'minimum site temperature (−60 to +30 °C)'));
  if (!isNum(inp.T_out_C)) bad('T_out_C', tr('výstupní teplota', 'outlet temperature'));
  if (!inRange(inp.T_pipe_min_C, -200, 50)) bad('T_pipe_min_C', tr('min. teplota potrubí (−200 až +50 °C)', 'min. piping temperature (−200 to +50 °C)'));
  if (!isNumOrNull(inp.TSL_C)) bad('TSL_C', 'TSL');
  if (!inRange(inp.TSL_margin_K, 0, 50)) bad('TSL_margin_K', tr('rezerva nad TSL (0–50 K)', 'margin above TSL (0–50 K)'));
  if (typeof inp.continuous24_7 !== 'boolean') bad('continuous24_7', tr('provoz 24/7 (ano / ne)', '24/7 operation (yes / no)'));
  if (!inRange(inp.hoursPerDay, 0, 24)) bad('hoursPerDay', tr('profil provozu (0–24 h/den)', 'operating profile (0–24 h/day)'));
  if (!AVAILABILITY.includes(inp.availability)) bad('availability', tr('dostupnost', 'availability'));
  if (inp.T_actual_out_C !== null && !inRange(inp.T_actual_out_C, -60, 40))
    bad('T_actual_out_C', tr('očekávaná výstupní teplota bez dohřevu (−60 až +40 °C)', 'expected outlet temperature without trim heater (−60 to +40 °C)'));
  if (inp.frostWeeks !== null && !inRange(inp.frostWeeks, 0, 52)) bad('frostWeeks', tr('délka mrazového období (0–52 týdnů)', 'length of frost period (0–52 weeks)'));
  if (!inRange(inp.RH_winter_pct, 0, 100)) bad('RH_winter_pct', tr('vlhkost (0–100 %)', 'humidity (0–100 %)'));
  if (typeof inp.catalogBasisId !== 'string' || !findBasis(inp.catalogBasisId, extraBases)) bad('catalogBasisId', tr('katalogový základ', 'catalogue basis'));
  if (!inRange(inp.k, 0.01, 10)) bad('k', tr('koeficient námrazy / rezervy (0–10)', 'frost / margin factor (0–10)'));
  return errs.length
    ? mk('K1', 'CHYBA', tr(`Neplatné nebo chybějící vstupy: ${errs.join(', ')}.`, `Invalid or missing inputs: ${errs.join(', ')}.`), { fields })
    : mk('K1', 'OK', tr('Všechny volby jsou vyplněné a platné.', 'All selections are filled in and valid.'));
}

export function checkK2(meta: FluidMeta, p_bar_a: number): CheckResult {
  const { p_min_bar_a: lo, p_max_bar_a: hi, p_crit_bar_a: pc, fluid } = meta;
  const range = `${fmt(lo, 0)}–${fmt(hi, 0)} bar a`;
  const o = { fields: ['pressure'] as InputField[] };
  if (p_bar_a < lo) return mk('K2', 'CHYBA', tr(`Tlak ${fmt(p_bar_a, 3)} bar a je pod rozsahem dat (${range}).`, `Pressure ${fmt(p_bar_a, 3)} bar a is below the data range (${range}).`), o);
  if (p_bar_a > hi) {
    if (fluid === 'N2') {
      const why =
        p_bar_a >= pc
          ? tr(
              `Tlak ${fmt(p_bar_a, 2)} bar a je nad kritickým tlakem dusíku (${fmt(pc, 2)} bar a), mimo rozsah.`,
              `Pressure ${fmt(p_bar_a, 2)} bar a is above the critical pressure of nitrogen (${fmt(pc, 2)} bar a), out of range.`,
            )
          : tr(
              `Tlak ${fmt(p_bar_a, 2)} bar a je blízko kritického tlaku dusíku (${fmt(pc, 2)} bar a), mimo rozsah fáze 1 (max. ${fmt(hi, 0)} bar a).`,
              `Pressure ${fmt(p_bar_a, 2)} bar a is close to the critical pressure of nitrogen (${fmt(pc, 2)} bar a), outside the phase 1 range (max. ${fmt(hi, 0)} bar a).`,
            );
      return mk(
        'K2',
        'CHYBA',
        `${why} ` +
          tr(
            'Nad kritickým tlakem kapalina nevře, rozklad na var a přehřátí ani model dvou zón neplatí. Nadkritický režim (vysokotlaké dusíkové odpařovače nad 34 bar) je samostatná úloha mimo rozsah.',
            'Above the critical pressure the liquid does not boil; the split into boiling and superheating and the two-zone model do not apply. Supercritical operation (high-pressure nitrogen vaporizers above 34 bar) is a separate task outside the scope.',
          ),
        o,
      );
    }
    return mk('K2', 'CHYBA', tr(`Tlak ${fmt(p_bar_a, 2)} bar a je nad rozsahem dat (${range}).`, `Pressure ${fmt(p_bar_a, 2)} bar a is above the data range (${range}).`), o);
  }
  return mk('K2', 'OK', tr(`Tlak ${fmt(p_bar_a, 3)} bar a je v rozsahu dat (${range}).`, `Pressure ${fmt(p_bar_a, 3)} bar a is within the data range (${range}).`));
}

export function checkK3(meta: FluidMeta, T_out_C: number): CheckResult {
  const lo = meta.T_gas_min_C;
  const hi = meta.T_gas_max_C;
  return T_out_C < lo || T_out_C > hi
    ? mk('K3', 'CHYBA', tr(`Výstupní teplota ${fmt(T_out_C, 1)} °C je mimo rozsah ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`, `Outlet temperature ${fmt(T_out_C, 1)} °C is outside the range ${fmt(lo, 0)} to +${fmt(hi, 0)} °C.`), {
        fields: ['T_out_C'],
      })
    : mk('K3', 'OK', tr(`Výstupní teplota ${fmt(T_out_C, 1)} °C je v rozsahu ${fmt(lo, 0)} až +${fmt(hi, 0)} °C.`, `Outlet temperature ${fmt(T_out_C, 1)} °C is within the range ${fmt(lo, 0)} to +${fmt(hi, 0)} °C.`));
}

export function checkK4(T_out_C: number, T_amb_C: number, T_des_C: number): CheckResult {
  if (T_out_C >= T_amb_C)
    return mk(
      'K4',
      'CHYBA',
      tr(
        `Výstupní teplota ${fmt(T_out_C, 1)} °C musí být nižší než teplota okolí ${fmt(T_amb_C, 1)} °C – atmosférický odpařovač teplo jen odebírá ze vzduchu.`,
        `Outlet temperature ${fmt(T_out_C, 1)} °C must be below the ambient temperature ${fmt(T_amb_C, 1)} °C – an ambient vaporizer only takes heat from the air.`,
      ),
      { fields: ['T_out_C', 'T_amb_C'] },
    );
  if (T_out_C >= T_des_C)
    return mk(
      'K4',
      'POZOR',
      tr(
        `Při min. teplotě lokality ${fmt(T_des_C, 1)} °C nelze výstupní teploty ${fmt(T_out_C, 1)} °C dosáhnout – nutný dohřev / jiný typ + TSL. Posouzení velikosti nelze.`,
        `At the minimum site temperature ${fmt(T_des_C, 1)} °C the outlet temperature ${fmt(T_out_C, 1)} °C cannot be reached – trim heater / other type + TSL needed. Sizing assessment not possible.`,
      ),
      { reference: 'AIGA 027 §5', fields: ['T_out_C', 'T_min_site_C'] },
    );
  return mk('K4', 'OK', tr(`Výstupní teplota je ${fmt(T_des_C - T_out_C, 1)} K pod teplotou vzduchu pro posouzení (${fmt(T_des_C, 1)} °C).`, `Outlet temperature is ${fmt(T_des_C - T_out_C, 1)} K below the design air temperature (${fmt(T_des_C, 1)} °C).`));
}

export function checkK5(meta: FluidMeta, props: PropertyProvider, inp: DesignInput, p_bar_a: number): CheckResult {
  if (inp.liquid.kind === 'saturated') return mk('K5', 'OK', tr('Nasycená kapalina při provozním tlaku (minimální výkon).', 'Saturated liquid at operating pressure (minimum duty).'));
  const T = inp.liquid.T_C;
  const T_sat = props.sat(p_bar_a).T_sat_C;
  const T_melt = props.meltT_C(p_bar_a);
  const o = { fields: ['liquid'] as InputField[] };
  if (T < meta.T_triple_C)
    return mk('K5', 'CHYBA', tr(`Teplota kapaliny ${fmt(T, 1)} °C je pod trojným bodem (${fmt(meta.T_triple_C, 2)} °C) – látka by byla pevná.`, `Liquid temperature ${fmt(T, 1)} °C is below the triple point (${fmt(meta.T_triple_C, 2)} °C) – the substance would be solid.`), o);
  if (T < T_melt)
    return mk(
      'K5',
      'CHYBA',
      tr(
        `Teplota kapaliny ${fmt(T, 2)} °C je pod křivkou tání (${fmt(T_melt, 2)} °C při ${fmt(p_bar_a, 2)} bar a) – látka by byla pevná.`,
        `Liquid temperature ${fmt(T, 2)} °C is below the melting line (${fmt(T_melt, 2)} °C at ${fmt(p_bar_a, 2)} bar a) – the substance would be solid.`,
      ),
      o,
    );
  if (T < meta.T_liq_min_C)
    return mk(
      'K5',
      'CHYBA',
      tr(
        `Teplota kapaliny ${fmt(T, 1)} °C je pod dolní mezí tabulky (${fmt(meta.T_liq_min_C, 0)} °C, těsně nad trojným bodem ${fmt(meta.T_triple_C, 2)} °C).`,
        `Liquid temperature ${fmt(T, 1)} °C is below the table limit (${fmt(meta.T_liq_min_C, 0)} °C, just above the triple point ${fmt(meta.T_triple_C, 2)} °C).`,
      ),
      o,
    );
  if (T > T_sat + 0.01)
    return mk(
      'K5',
      'CHYBA',
      tr(
        `Teplota kapaliny ${fmt(T, 2)} °C je nad teplotou nasycení ${fmt(T_sat, 2)} °C při ${fmt(p_bar_a, 3)} bar a – na vstupu by nebyla kapalina.`,
        `Liquid temperature ${fmt(T, 2)} °C is above the saturation temperature ${fmt(T_sat, 2)} °C at ${fmt(p_bar_a, 3)} bar a – there would be no liquid at the inlet.`,
      ),
      o,
    );
  return mk('K5', 'OK', tr(`Podchlazená kapalina ${fmt(T, 1)} °C (T_sat = ${fmt(T_sat, 2)} °C, podchlazení ${fmt(T_sat - T, 1)} K).`, `Subcooled liquid ${fmt(T, 1)} °C (T_sat = ${fmt(T_sat, 2)} °C, subcooling ${fmt(T_sat - T, 1)} K).`));
}

const LTP_NOTE = () =>
  tr(
    'Ochranu proti nízké teplotě (TSL) je nutné posoudit podle AIGA 027; rozsah a SIL určí HAZOP / LOPA.',
    'Low-temperature protection (TSL) must be assessed per AIGA 027; scope and SIL are set by HAZOP / LOPA.',
  );

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
      tr(
        `Výstupní teplota ${fmt(T_out_C, 1)} °C je pod min. návrhovou teplotou navazujícího potrubí ${fmt(T_pipe_min_C, 1)} °C – riziko křehkého lomu.`,
        `Outlet temperature ${fmt(T_out_C, 1)} °C is below the minimum design temperature of the downstream piping ${fmt(T_pipe_min_C, 1)} °C – risk of brittle fracture.`,
      ),
      { reference: 'AIGA 027', fields },
    );
  if (T_des_C <= T_pipe_min_C + EQ_EPS) {
    const why = tr(
      `Při teplotě vzduchu ${fmt(T_des_C, 1)} °C (≤ mez potrubí ${fmt(T_pipe_min_C, 1)} °C) bude výstup atmosférického odpařovače nutně pod mezí potrubí – plyn je vždy chladnější než vzduch.`,
      `At an air temperature of ${fmt(T_des_C, 1)} °C (≤ piping limit ${fmt(T_pipe_min_C, 1)} °C) the outlet of an ambient vaporizer will necessarily be below the piping limit – the gas is always colder than the air.`,
    );
    if (T_actual_out_C === null)
      return mk(
        'K6',
        'CHYBA',
        `${why} ${tr('Nutný dohřev s TSL za dohřevem, nebo první úsek potrubí z nerezu / nízkoteplotní oceli (nižší mez).', 'A trim heater with TSL downstream of it is needed, or a first piping section of stainless / low-temperature steel (lower limit).')}`,
        { reference: 'AIGA 027', fields: ['T_pipe_min_C', 'T_min_site_C', 'T_actual_out_C'], designFailure: tr('křehký lom', 'brittle fracture') },
      );
    return mk('K6', 'POZOR', `${why} ${tr('Ochrana spoléhá na dohřev – viz D2.', 'Protection relies on the trim heater – see D2.')}`, { reference: 'AIGA 027', fields });
  }
  if (Math.abs(T_out_C - T_pipe_min_C) <= EQ_EPS)
    return mk('K6', 'POZOR', tr(`Výstupní teplota je rovna mezi potrubí ${fmt(T_pipe_min_C, 1)} °C – bez rezervy.`, `Outlet temperature equals the piping limit ${fmt(T_pipe_min_C, 1)} °C – no margin.`), { reference: 'AIGA 027', fields });
  return mk('K6', 'OK', `${tr(`Výstupní teplota je ${fmt(T_out_C - T_pipe_min_C, 1)} K nad mezí potrubí.`, `Outlet temperature is ${fmt(T_out_C - T_pipe_min_C, 1)} K above the piping limit.`)} ${LTP_NOTE()}`, { reference: 'AIGA 027' });
}

export function checkK7(T_amb_C: number, T_min_site_C: number | null): CheckResult {
  if (T_min_site_C === null)
    return mk(
      'K7',
      'NEZADÁNO',
      tr(
        `Minimální návrhová teplota okolí lokality není zadaná – velikost se posuzuje při teplotě okolí ${fmt(T_amb_C, 1)} °C a pro zimu nemusí platit. ČSN výpočtové teploty pro vytápění nejsou absolutní minima.`,
        `The minimum design ambient temperature of the site is not set – sizing is assessed at the ambient temperature ${fmt(T_amb_C, 1)} °C and may not hold in winter. Design temperatures for heating (ČSN) are not absolute minima.`,
      ),
      { reference: 'AIGA 027 §5', fields: ['T_min_site_C'] },
    );
  if (T_amb_C > T_min_site_C)
    return mk('K7', 'INFO', tr(`Velikost posouzena při min. teplotě lokality ${fmt(T_min_site_C, 1)} °C.`, `Sizing assessed at the minimum site temperature ${fmt(T_min_site_C, 1)} °C.`), { reference: 'AIGA 027 §5' });
  return mk('K7', 'OK', tr(`Teplota okolí pro výpočet (${fmt(T_amb_C, 1)} °C) není vyšší než minimum lokality.`, `Ambient temperature for the calculation (${fmt(T_amb_C, 1)} °C) is not above the site minimum.`), { reference: 'AIGA 027 §5' });
}

export function checkK8(T_out_C: number, T_pipe_min_C: number, TSL_C: number | null, margin_K: number): CheckResult {
  const fields: InputField[] = ['TSL_C'];
  if (TSL_C === null) return mk('K8', 'NEZADÁNO', `${tr('TSL není zadané.', 'TSL is not set.')} ${LTP_NOTE()}`, { reference: 'AIGA 027', fields });
  if (TSL_C < T_pipe_min_C - EQ_EPS || T_out_C <= TSL_C + EQ_EPS) {
    const errors: string[] = [];
    if (TSL_C < T_pipe_min_C - EQ_EPS)
      errors.push(tr(`TSL ${fmt(TSL_C, 1)} °C je pod mezí potrubí ${fmt(T_pipe_min_C, 1)} °C (AIGA 027 čl. 9.2.2.1).`, `TSL ${fmt(TSL_C, 1)} °C is below the piping limit ${fmt(T_pipe_min_C, 1)} °C (AIGA 027 cl. 9.2.2.1).`));
    if (T_out_C <= TSL_C + EQ_EPS)
      errors.push(tr(`Výstupní teplota ${fmt(T_out_C, 1)} °C není nad TSL ${fmt(TSL_C, 1)} °C – odpařovač by vypínal.`, `Outlet temperature ${fmt(T_out_C, 1)} °C is not above TSL ${fmt(TSL_C, 1)} °C – the vaporizer would trip.`));
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
      tr(
        `TSL ${fmt(TSL_C, 1)} °C je rovno mezi potrubí – bez rezervy na přesnost čidla a dobu odezvy čidla a zavření armatury.`,
        `TSL ${fmt(TSL_C, 1)} °C equals the piping limit – no margin for sensor accuracy, sensor response and valve closing time.`,
      ),
      { reference: 'AIGA 027', fields },
    );
  const reserve = T_out_C - TSL_C;
  if (reserve < margin_K - EQ_EPS)
    return mk(
      'K8',
      'POZOR',
      tr(
        `Rezerva výstupní teploty nad TSL je ${fmt(reserve, 1)} K, požadováno ${fmt(margin_K, 1)} K. TSL se nikdy nesnižuje kvůli častému vypínání.`,
        `Outlet temperature margin above TSL is ${fmt(reserve, 1)} K, required ${fmt(margin_K, 1)} K. TSL is never lowered because of frequent trips.`,
      ),
      { reference: 'AIGA 027', fields: ['TSL_C', 'T_out_C'] },
    );
  return mk(
    'K8',
    'OK',
    tr(
      `Hierarchie mez potrubí ${fmt(T_pipe_min_C, 1)} < TSL ${fmt(TSL_C, 1)} < T_out ${fmt(T_out_C, 1)} °C, rezerva ${fmt(reserve, 1)} K.`,
      `Hierarchy piping limit ${fmt(T_pipe_min_C, 1)} < TSL ${fmt(TSL_C, 1)} < T_out ${fmt(T_out_C, 1)} °C, margin ${fmt(reserve, 1)} K.`,
    ),
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
    missing.push(tr('min. teplota lokality', 'min. site temperature'));
    fields.push('T_min_site_C');
  }
  return missing.length
    ? mk('D1', 'NEZADÁNO', tr(`Chybí: ${missing.join(', ')}. Bez nich nelze návrh považovat za úplný.`, `Missing: ${missing.join(', ')}. Without them the design cannot be considered complete.`), {
        fields,
        missing,
      })
    : mk('D1', 'OK', tr('TSL i minimální teplota lokality jsou zadané.', 'Both TSL and the minimum site temperature are set.'));
}

/** D2 – úsek mezi odpařovačem a dohřevem (zadání 6.2). */
export function checkD2(T_out_C: number, T_pipe_min_C: number, T_actual_out_C: number | null): CheckResult {
  if (T_actual_out_C === null) return mk('D2', 'OK', tr('Dohřev se neuvažuje (očekávaná T_out bez dohřevu nezadaná).', 'No trim heater considered (expected T_out without heater not set).'));
  const rules = tr(
    'Úsek mezi odpařovačem a dohřevem z nerezu, TSL až ZA dohřevem, porucha dohřevu musí uzavřít přívod.',
    'Section between vaporizer and trim heater in stainless steel, TSL DOWNSTREAM of the heater, heater failure must shut off the supply.',
  );
  if (T_actual_out_C < T_pipe_min_C - EQ_EPS)
    return mk(
      'D2',
      'POZOR',
      `${tr(`Bez dohřevu ${fmt(T_actual_out_C, 1)} °C – pod mezí potrubí ${fmt(T_pipe_min_C, 1)} °C.`, `Without heater ${fmt(T_actual_out_C, 1)} °C – below the piping limit ${fmt(T_pipe_min_C, 1)} °C.`)} ${rules}`,
      { reference: 'AIGA 027', fields: ['T_actual_out_C', 'T_pipe_min_C'] },
    );
  if (T_actual_out_C < T_out_C)
    return mk('D2', 'INFO', `${tr(`Dohřev z ${fmt(T_actual_out_C, 1)} °C na ${fmt(T_out_C, 1)} °C.`, `Trim heating from ${fmt(T_actual_out_C, 1)} °C to ${fmt(T_out_C, 1)} °C.`)} ${rules}`);
  return mk('D2', 'OK', tr('Očekávaná výstupní teplota bez dohřevu dosahuje návrhové – dohřev není potřeba.', 'The expected outlet temperature without heater reaches the design value – no trim heater needed.'));
}

/** D3 – věrohodnost vstupů a mez platnosti modelu. */
export function checkD3(inp: DesignInput, T_des_C: number): CheckResult {
  const warn: string[] = [];
  const info: string[] = [];
  const fields: InputField[] = [];
  if (inp.k < 1) {
    warn.push(tr(`k = ${fmt(inp.k, 2)} < 1 znamená „lepší než ideální model konstantního U“ – nevěrohodné.`, `k = ${fmt(inp.k, 2)} < 1 means “better than the ideal constant-U model” – not plausible.`));
    fields.push('k');
  }
  const approach = T_des_C - inp.T_out_C;
  if (approach > 0 && approach < MIN_PLAUSIBLE_APPROACH_K) {
    warn.push(
      tr(
        `Přiblížení ${fmt(approach, 1)} K < ${MIN_PLAUSIBLE_APPROACH_K} K – mimo věrohodnost modelu; potřebná plocha roste neomezeně, rozhoduje výrobce.`,
        `Approach ${fmt(approach, 1)} K < ${MIN_PLAUSIBLE_APPROACH_K} K – outside the model's plausibility; required area grows without bound, the manufacturer decides.`,
      ),
    );
    fields.push('T_out_C');
  }
  if (inp.TSL_margin_K < DEFAULT_TSL_MARGIN_K) {
    info.push(
      tr(
        `Požadovaná rezerva nad TSL ${fmt(inp.TSL_margin_K, 1)} K je menší než výchozích ${DEFAULT_TSL_MARGIN_K} K – zdůvodni v analýze rizik.`,
        `Required margin above TSL ${fmt(inp.TSL_margin_K, 1)} K is below the default ${DEFAULT_TSL_MARGIN_K} K – justify in the risk analysis.`,
      ),
    );
    fields.push('TSL_margin_K');
  }
  if (warn.length) return mk('D3', 'POZOR', [...warn, ...info].join(' '), { fields });
  if (info.length) return mk('D3', 'INFO', info.join(' '), { fields });
  return mk('D3', 'OK', tr('Vstupy jsou ve věrohodném rozsahu modelu.', 'Inputs are within the plausible range of the model.'));
}

/** D4 – profil provozu proti době provozu katalogového základu. */
export function checkD4(inp: DesignInput, T_des_C: number, basis: CatalogBasis | undefined): CheckResult {
  const rt = basis?.runtime_h ?? null;
  if (rt === null) return mk('D4', 'INFO', tr('Katalogový základ neuvádí dobu provozu – vyžádej ji od výrobce.', 'The catalogue basis does not state an operating time – ask the manufacturer.'));
  const hours = inp.continuous24_7 ? 24 : inp.hoursPerDay;
  if (hours > rt && T_des_C < 0)
    return mk(
      'D4',
      'POZOR',
      tr(
        `Katalogová kapacita platí pro ${fmt(rt, 0)} h provozu, profil je ${inp.continuous24_7 ? '24/7' : `${fmt(hours, 0)} h/den`}. V mrazu odstavená větev prakticky neodtává – vyžádej přepočet výrobce na délku cyklu a mrazové období.`,
        `The catalogue capacity applies to ${fmt(rt, 0)} h of operation, the profile is ${inp.continuous24_7 ? '24/7' : `${fmt(hours, 0)} h/day`}. In frost an idle branch hardly defrosts – ask the manufacturer to re-rate for the cycle length and the frost period.`,
      ),
      { fields: ['hoursPerDay', 'continuous24_7'] },
    );
  return mk('D4', 'OK', tr(`Profil provozu nepřesahuje katalogovou dobu ${fmt(rt, 0)} h, nebo není mráz.`, `The operating profile does not exceed the catalogue time of ${fmt(rt, 0)} h, or there is no frost.`));
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
      notEvaluated(id, tr('Nehodnoceno – nejdřív oprav K1.', 'Not evaluated – fix K1 first.')),
    );
    return finish([k1, ...rest], null, null);
  }
  const props = getProps(inp.fluid);
  const meta = props.meta;
  const p_bar_a = toAbsBar(inp.pressure, inp.p_atm_bar_a);
  const T_des_C = designAirTemp(inp.T_amb_C, inp.T_min_site_C);
  const k2 = checkK2(meta, p_bar_a);
  const k5 =
    k2.level === 'CHYBA'
      ? notEvaluated('K5', tr('Nehodnoceno – tlak mimo rozsah (K2).', 'Not evaluated – pressure out of range (K2).'))
      : checkK5(meta, props, inp, p_bar_a);
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
  const base = statusBase(status);
  if (status === 'DESIGN_FAILS') {
    const why = [...new Set(checks.map((c) => c.designFailure).filter(Boolean))];
    return `${base} – ${why.join(', ')}`;
  }
  const d1 = checks.find((c) => c.id === 'D1' && c.level === 'NEZADÁNO');
  const missing = d1?.missing?.join(', ') ?? '';
  if (status === 'INCOMPLETE') return `${base} – ${tr('chybí', 'missing')}: ${missing}`;
  if (status === 'VALID_WITH_WARNINGS' && missing) return `${base}; ${tr('chybí', 'missing')}: ${missing}`;
  return base;
}

function finish(checks: CheckResult[], p_bar_a: number | null, T_des_C: number | null): ChecksOutput {
  const status = overallStatus(checks);
  return { checks, status, statusText: statusSentence(status, checks), p_bar_a, T_des_C };
}
