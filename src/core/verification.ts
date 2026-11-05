/**
 * Referenční případy kap. 9 (CoolProp 7.2.0, h = 0 pro nasycenou kapalinu při 1,01325 bar,
 * V̇n = 1000 Nm³/h) a jejich vyhodnocení proti aktuálnímu jádru. Hodnoty jsou přepsané
 * ze zadání. Používá stránka Ověření i testy.
 */
import arRef from '../data/reference/Ar.json';
import { CATALOG_MODEL_SETS, findBasis } from './catalog';
import { evaluate } from './evaluate';
import { computeDuty, reheat } from './duty';
import { FLUID_POLICY } from './fluids';
import { defaultInput, type DesignInput } from './input';
import { getProvider } from './properties';
import { FLUID_IDS, type FluidId } from './properties/types';
import { absoluteHumidity_g_kg } from './psychro';
import { catalogUA1, sizeBranch } from './sizing';
import { levelText, statusBase } from './checks';
import { getLang, setLang, tr } from './i18n';

export type Tolerance = { kind: 'rel'; value: number } | { kind: 'abs'; value: number };

export const TOL_Q: Tolerance = { kind: 'rel', value: 1e-3 };
export const TOL_T: Tolerance = { kind: 'abs', value: 0.05 };
export const TOL_H: Tolerance = { kind: 'abs', value: 0.02 };

export interface NumericRow {
  type: 'num';
  group: string;
  fluid: FluidId | 'společné';
  name: string;
  unit: string;
  ref: number;
  actual: number;
  tol: Tolerance;
  /** Odchylka: relativní [–] nebo absolutní [jednotka], podle tolerance. */
  deviation: number;
  pass: boolean;
}

export interface CheckRow {
  type: 'check';
  group: string;
  fluid: FluidId | 'společné';
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export type VerificationRow = NumericRow | CheckRow;

const P6 = 6.01325;

/** Překlad názvů referenčních případů (data jsou česky). */
function caseName(n: string): string {
  if (getLang() !== 'en') return n;
  return n
    .replace(/^Výchozí/, 'Default')
    .replace(/^Nasycená/, 'Saturated')
    .replace(/nasycená/g, 'saturated')
    .replace(/^Mimo mřížku/, 'Off-grid')
    .replace(/ a TSL /g, ' and TSL ')
    .replace(/(\d),(\d)/g, '$1.$2');
}

function num(
  group: string,
  fluid: NumericRow['fluid'],
  name: string,
  unit: string,
  ref: number,
  actual: number,
  tol: Tolerance,
): NumericRow {
  const deviation = tol.kind === 'rel' ? actual / ref - 1 : actual - ref;
  return { type: 'num', group, fluid, name: caseName(name), unit, ref, actual, tol, deviation, pass: Math.abs(deviation) <= tol.value };
}

interface QCase {
  name: string;
  p: number;
  Tout: number;
  Tin: number | null;
  Q: number;
  QI?: number;
  QII?: number;
}

const Q_CASES: Record<FluidId, QCase[]> = {
  O2: [
    { name: 'Výchozí', p: P6, Tout: -30, Tin: -183, Q: 139.711 },
    { name: 'Nasycená', p: P6, Tout: -30, Tin: null, Q: 124.926 },
    { name: 'T_out −25', p: P6, Tout: -25, Tin: -183, Q: 141.552 },
    { name: 'T_out −20', p: P6, Tout: -20, Tin: -183, Q: 143.393 },
    { name: '5 bar a, nasycená', p: 5.0, Tout: -30, Tin: null, Q: 127.011 },
    { name: '40 bar a, −124,8 °C', p: 40, Tout: -30, Tin: -124.8, Q: 87.033 },
    { name: '40 bar a, −183 °C', p: 40, Tout: -30, Tin: -183, Q: 134.019 },
    { name: 'Mimo mřížku 20,5 bar a / −57,5 °C / −150,5 °C', p: 20.5, Tout: -57.5, Tin: -150.5, Q: 103.692 },
  ],
  N2: [
    { name: 'Výchozí', p: P6, Tout: -30, Tin: -196, Q: 129.337, QI: 72.689, QII: 56.648 },
    { name: 'Nasycená', p: P6, Tout: -30, Tin: null, Q: 115.211, QI: 58.563, QII: 56.648 },
    { name: 'T_out −25', p: P6, Tout: -25, Tin: -196, Q: 131.169 },
    { name: 'T_out −20', p: P6, Tout: -20, Tin: -196, Q: 133.0 },
    { name: '5 bar a, nasycená', p: 5.0, Tout: -30, Tin: null, Q: 117.2 },
    { name: '15 barg, T_out −20', p: 16.01325, Tout: -20, Tin: -196, Q: 131.675 },
    { name: '30 bar a, nasycená', p: 30, Tout: -30, Tin: null, Q: 84.914, QI: 22.668, QII: 62.245 },
    { name: '30 bar a, −196 °C', p: 30, Tout: -30, Tin: -196, Q: 125.952 },
  ],
  // Ar: zadání předepisuje referenci vygenerovat z CoolProp stejnou sadou případů (tools/gen_tables.py)
  Ar: arRef.cases.map((c) => ({ ...c, QI: c.QI ?? undefined, QII: c.QII ?? undefined })),
};

const PROPS_REF = {
  O2: { rho_n: 1.429033, nbp: -182.962, r_atm: 213.06, Tsat: -161.661, r: 187.53, hl: 37.448, hv: 224.978, hgas: 352.16, hliq: 0.202 },
  N2: { rho_n: 1.250386, nbp: -195.795, r_atm: 199.18, Tsat: -176.74, r: 168.609, hl: 40.603, hv: 209.212, hgas: 372.308, hliq: -0.068 },
  Ar: arRef.props,
} as const satisfies Record<FluidId, Record<string, number>>;

const UA1_REF: Record<FluidId, number> = { O2: 1.5229, N2: 1.4503, Ar: arRef.ua1_chart };

const NEQ_REF: Record<FluidId, { Ta: number; Tout: number; N: number }[]> = {
  O2: [
    { Ta: 0, Tout: -30, N: 786.5 },
    { Ta: -15, Tout: -30, N: 973.6 },
    { Ta: -15, Tout: -20, N: 1247.8 },
  ],
  N2: [
    { Ta: 0, Tout: -30, N: 755.6 },
    { Ta: -15, Tout: -30, N: 942.8 },
    { Ta: -15, Tout: -25, N: 1049.5 },
    { Ta: -15, Tout: -20, N: 1232.3 },
  ],
  Ar: arRef.neq,
};

const REHEAT_REF: Record<FluidId, { to: number; Q: number }[]> = {
  O2: [
    { to: -30, Q: 3.686 },
    { to: -20, Q: 7.37 },
  ],
  N2: [
    { to: -30, Q: 3.669 },
    { to: -20, Q: 7.332 },
  ],
  Ar: arRef.reheat,
};

function fluidRows(f: FluidId): VerificationRow[] {
  const props = getProvider(f);
  const ref = PROPS_REF[f];
  const Tin0 = FLUID_POLICY[f].T_in_default_C;
  const s = props.sat(P6);
  const rows: VerificationRow[] = [
    num(tr('Vlastnosti', 'Properties'), f, tr('ρn (0 °C; 1,01325 bar)', 'ρn (0 °C; 1.01325 bar)'), 'kg/Nm³', ref.rho_n, props.meta.rho_n_kg_Nm3, { kind: 'abs', value: 5e-7 }),
    num(tr('Vlastnosti', 'Properties'), f, tr('Normální bod varu', 'Normal boiling point'), '°C', ref.nbp, props.sat(1.01325).T_sat_C, TOL_T),
    num(tr('Vlastnosti', 'Properties'), f, 'r(1 atm)', 'kJ/kg', ref.r_atm, props.sat(1.01325).r_kJ_kg, TOL_Q),
    num(tr('Vlastnosti', 'Properties'), f, 'T_sat(6,01325 bar a)', '°C', ref.Tsat, s.T_sat_C, TOL_T),
    num(tr('Vlastnosti', 'Properties'), f, 'r(6,01325 bar a)', 'kJ/kg', ref.r, s.r_kJ_kg, TOL_H),
    num(tr('Vlastnosti', 'Properties'), f, 'h_l,sat(6,01325 bar a)', 'kJ/kg', ref.hl, s.h_l_kJ_kg, TOL_H),
    num(tr('Vlastnosti', 'Properties'), f, 'h_v,sat(6,01325 bar a)', 'kJ/kg', ref.hv, s.h_v_kJ_kg, TOL_H),
    num(tr('Vlastnosti', 'Properties'), f, 'h(6,01325 bar a; −30 °C)', 'kJ/kg', ref.hgas, props.gasH(P6, -30), TOL_H),
    num(tr('Vlastnosti', 'Properties'), f, `h_l(6,01325 bar a; ${Tin0} °C)`.replace('-', '−'), 'kJ/kg', ref.hliq, props.liquid(P6, Tin0).h_kJ_kg, TOL_H),
  ];
  for (const c of Q_CASES[f]) {
    const d = computeDuty(props, {
      Vn_Nm3_h: 1000,
      p_bar_a: c.p,
      T_out_C: c.Tout,
      liquid: c.Tin === null ? { kind: 'saturated' } : { kind: 'subcooled', T_C: c.Tin },
    });
    rows.push(num(tr('Výkon Q', 'Duty Q'), f, c.name, 'kW', c.Q, d.Q_kW, TOL_Q));
    if (c.QI !== undefined) rows.push(num(tr('Výkon Q', 'Duty Q'), f, `${c.name} – Q_I`, 'kW', c.QI, d.Q_I_kW, TOL_Q));
    if (c.QII !== undefined) rows.push(num(tr('Výkon Q', 'Duty Q'), f, `${c.name} – Q_II`, 'kW', c.QII, d.Q_II_kW, TOL_Q));
  }
  const chart = findBasis('chart-supergap-eu')!;
  const ua1 = catalogUA1(props, chart);
  if (ua1.ok)
    rows.push(num(tr('Velikost', 'Sizing'), f, 'UA₁ (Chart SuperGap EU)', tr('W/K na Nm³/h', 'W/K per Nm³/h'), UA1_REF[f], ua1.UA1_W_K_per_Nm3h, { kind: 'abs', value: 5e-4 }));
  for (const c of NEQ_REF[f]) {
    const d = computeDuty(props, { Vn_Nm3_h: 1000, p_bar_a: P6, T_out_C: c.Tout, liquid: { kind: 'subcooled', T_C: Tin0 } });
    const sz = sizeBranch(props, d, chart, c.Ta, 1);
    rows.push(
      num(tr('Velikost', 'Sizing'), f, `N_eq ${c.Ta} °C / ${c.Tout} °C`.replace(/-/g, '−'), 'Nm³/h', c.N, sz.ok ? sz.N_eq_Nm3_h : Number.NaN, TOL_Q),
    );
  }
  const m = computeDuty(props, { Vn_Nm3_h: 1000, p_bar_a: P6, T_out_C: -30, liquid: { kind: 'subcooled', T_C: Tin0 } }).m_kg_s;
  for (const r of REHEAT_REF[f]) {
    rows.push(
      num(tr('Dohřev', 'Trim heater'), f, `−40 → ${r.to} °C`.replace('-', '−'), 'kW', r.Q, reheat(props, m, P6, -40, r.to)?.Q_kW ?? Number.NaN, TOL_Q),
    );
  }
  return rows;
}

function checkRow(
  name: string,
  fluid: CheckRow['fluid'],
  inp: DesignInput,
  expected: string,
  test: (e: ReturnType<typeof evaluate>) => { pass: boolean; actual: () => string },
): CheckRow {
  // vyhodnocení vždy v češtině – testy porovnávají texty zpráv ze zadání
  const prev = getLang();
  setLang('cs');
  let r: { pass: boolean; actual: () => string };
  try {
    r = test(evaluate(inp));
  } finally {
    setLang(prev);
  }
  return { type: 'check', group: tr('Kontroly', 'Checks'), fluid, name, expected, actual: r.actual(), pass: r.pass };
}

function level(e: ReturnType<typeof evaluate>, id: string) {
  return e.checks.find((c) => c.id === id)!;
}

export function runVerification(): VerificationRow[] {
  const rows: VerificationRow[] = FLUID_IDS.flatMap(fluidRows);
  rows.push(
    num(tr('Psychrometrie', 'Psychrometrics'), 'společné', '20 °C / 75 % RH', 'g/kg', 10.93, absoluteHumidity_g_kg(20, 75), { kind: 'abs', value: 0.005 }),
    num(tr('Psychrometrie', 'Psychrometrics'), 'společné', tr('−15 °C / 85 % RH (nad ledem)', '−15 °C / 85 % RH (over ice)'), 'g/kg', 0.86, absoluteHumidity_g_kg(-15, 85), { kind: 'abs', value: 0.005 }),
  );
  rows.push(
    checkRow(tr('N₂ při 35 bar a', 'N₂ at 35 bar a'), 'N2', { ...defaultInput('N2'), pressure: { value: 35, kind: 'abs' } }, tr('K2 CHYBA „nad kritickým tlakem dusíku, mimo rozsah“', 'K2 ERROR “above the critical pressure of nitrogen, out of range”'), (e) => {
      const k = level(e, 'K2');
      return { pass: k.level === 'CHYBA' && k.message.includes('nad kritickým tlakem dusíku') && k.message.includes('mimo rozsah'), actual: () => `K2 ${levelText(k.level)}` };
    }),
    checkRow(tr('Ar při 41 bar a', 'Ar at 41 bar a'), 'Ar', { ...defaultInput('Ar'), pressure: { value: 41, kind: 'abs' } }, tr('K2 CHYBA (mimo rozsah 1–40 bar a)', 'K2 ERROR (outside the range 1–40 bar a)'), (e) => {
      const k = level(e, 'K2');
      return { pass: k.level === 'CHYBA' && e.duty === null, actual: () => `K2 ${levelText(k.level)}` };
    }),
    checkRow(tr('Ar s kapalinou −195 °C', 'Ar with liquid at −195 °C'), 'Ar', { ...defaultInput('Ar'), liquid: { kind: 'subcooled', T_C: -195 } }, tr('K5 CHYBA (pod trojným bodem −189,34 °C)', 'K5 ERROR (below the triple point −189.34 °C)'), (e) => {
      const k = level(e, 'K5');
      return { pass: k.level === 'CHYBA' && k.message.includes('pod trojným bodem'), actual: () => `K5 ${levelText(k.level)}` };
    }),
    checkRow(tr('N₂ s kapalinou −215 °C', 'N₂ with liquid at −215 °C'), 'N2', { ...defaultInput('N2'), liquid: { kind: 'subcooled', T_C: -215 } }, tr('K5 CHYBA (pod trojným bodem)', 'K5 ERROR (below the triple point)'), (e) => {
      const k = level(e, 'K5');
      return { pass: k.level === 'CHYBA' && k.message.includes('pod trojným bodem'), actual: () => `K5 ${levelText(k.level)}` };
    }),
  );
  for (const f of FLUID_IDS) {
    rows.push(
      checkRow(tr('T_out −25 °C a TSL −25 °C', 'T_out −25 °C and TSL −25 °C'), f, { ...defaultInput(f), T_out_C: -25, TSL_C: -25 }, tr('K8 CHYBA, „Výkon platný, ale NÁVRH NEVYHOVUJE“', 'K8 ERROR, “Duty valid, but DESIGN FAILS”'), (e) => {
        const k = level(e, 'K8');
        return { pass: k.level === 'CHYBA' && e.status === 'DESIGN_FAILS', actual: () => `K8 ${levelText(k.level)}; ${statusBase(e.status)}` };
      }),
      checkRow(tr('T_min −35 °C a T_out −30 °C', 'T_min −35 °C and T_out −30 °C'), f, { ...defaultInput(f), T_min_site_C: -35, T_out_C: -30 }, tr('K4 POZOR, posouzení velikosti „nelze“', 'K4 WARNING, sizing “not possible”'), (e) => {
        const k = level(e, 'K4');
        const sizingNo = e.sizing !== null && !e.sizing.ok;
        return {
          pass: k.level === 'POZOR' && sizingNo,
          actual: () => `K4 ${levelText(k.level)}; ${sizingNo ? tr('velikost nelze', 'sizing not possible') : tr('velikost spočtena', 'sizing calculated')}`,
        };
      }),
    );
  }
  return rows;
}

/** Poučný příklad (kap. 7): fyzika (konstantní U) vs. katalog výrobce pro poměr LIN/LOX. */
export interface LinLoxLesson {
  ua1_O2: number;
  ua1_N2: number;
  /** UA₁(O₂)/UA₁(N₂) – poměr, který by dal model konstantního U */
  physicsRatio: number;
  models: { model: string; LOX: number; LIN: number; ratio: number }[];
  catalogMin: number;
  catalogMax: number;
}

export function linLoxLesson(): LinLoxLesson | null {
  const chart = findBasis('chart-supergap-eu');
  const set = CATALOG_MODEL_SETS.find((s) => s.basisId === 'chart-supergap-eu');
  if (!chart || !set) return null;
  const a = catalogUA1(getProvider('O2'), chart);
  const b = catalogUA1(getProvider('N2'), chart);
  if (!a.ok || !b.ok) return null;
  const models = set.models.map((m) => ({ model: m.model, LOX: m.LOX, LIN: m.LIN, ratio: m.LIN / m.LOX }));
  const ratios = models.map((m) => m.ratio);
  return {
    ua1_O2: a.UA1_W_K_per_Nm3h,
    ua1_N2: b.UA1_W_K_per_Nm3h,
    physicsRatio: a.UA1_W_K_per_Nm3h / b.UA1_W_K_per_Nm3h,
    models,
    catalogMin: Math.min(...ratios),
    catalogMax: Math.max(...ratios),
  };
}
