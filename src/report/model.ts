/**
 * Model reportu – jediný zdroj obsahu pro PDF i Excel. Čistá funkce nad výsledkem
 * výpočtu. Každá hodnota nese jednotku a původ (VÝPOČET / PRAXE / ÚDAJ VÝROBCE / VSTUP).
 */
import type { CatalogBasis } from '../core/catalog';
import { concepts, roleLabel } from '../core/concept';
import { levelText } from '../core/checks';
import { getLang, tr } from '../core/i18n';
import type { Evaluation } from '../core/evaluate';
import { FLUID_POLICY } from '../core/fluids';
import { fmt } from '../core/format';
import { buildInquiry, checkInquiry, fieldValue, missingInquiryFields, type InquiryOverrides } from '../core/inquiry';
import { getProvider } from '../core/properties';
import { FLOW_PER_NM3, toNm3h } from '../core/units';

export type RowSource = 'VYPOCET' | 'PRAXE' | 'VYROBCE' | 'VSTUP' | 'DOPLNIT' | '';

export function sourceShort(s: RowSource): string {
  const m: Record<RowSource, [string, string]> = {
    VYPOCET: ['VÝPOČET', 'CALC'],
    PRAXE: ['PRAXE', 'PRACTICE'],
    VYROBCE: ['VÝROBCE', 'MANUF.'],
    VSTUP: ['VSTUP', 'INPUT'],
    DOPLNIT: ['DOPLNIT', 'TO FILL'],
    '': ['', ''],
  };
  return tr(m[s][0], m[s][1]);
}
/** Kompatibilita: zkratky původu v aktuálním jazyce. */
export const SOURCE_SHORT: Record<RowSource, string> = new Proxy({} as Record<RowSource, string>, {
  get: (_t, k) => sourceShort(k as RowSource),
});

export interface ReportRow {
  label: string;
  /** zobrazený text hodnoty (CZ formát) */
  text: string;
  /** číselná hodnota pro Excel (bez zaokrouhlení) */
  num?: number;
  decimals?: number;
  unit: string;
  source: RowSource;
}

export interface ReportTable {
  head: string[];
  body: string[][];
  /** šířky sloupců v poměru (PDF) */
  widths?: number[];
}

export interface ReportSection {
  id: string;
  title: string;
  rows?: ReportRow[];
  table?: ReportTable;
  paragraphs?: string[];
  bullets?: string[];
}

export interface ReportModel {
  kind: 'report' | 'inquiry';
  title: string;
  subtitle: string;
  appVersion: string;
  coolpropVersion: string;
  /** ISO 8601 */
  createdIso: string;
  createdText: string;
  status: string;
  disclaimer: string;
  sections: ReportSection[];
}

export const disclaimer = () =>
  tr('Aplikace není náhradou výběru a garance výrobce. Velikost odpařovače vždy potvrzuje výrobce přepočtem na konkrétní lokalitu.', 'The application is no substitute for the manufacturer’s selection and guarantee. The vaporizer size is always confirmed by the manufacturer’s re-rating to the specific site.');

const num = (label: string, v: number, unit: string, source: RowSource, decimals = 2): ReportRow => ({
  label,
  text: fmt(v, decimals),
  num: v,
  decimals,
  unit,
  source,
});
const txt = (label: string, text: string, source: RowSource, unit = ''): ReportRow => ({ label, text, unit, source });

const FLOW_UNIT_LABEL: Record<keyof typeof FLOW_PER_NM3, string> = {
  'Nm3/h': 'Nm³/h',
  'Sm3/h': 'Sm³/h',
  scfh60: 'scfh (60 °F)',
  scfh70: 'scfh (70 °F)',
};

export interface ReportOptions {
  kind: 'report' | 'inquiry';
  basis: CatalogBasis | undefined;
  inquiry: InquiryOverrides;
  appVersion: string;
  now?: Date;
}

function inputsSection(ev: Evaluation, basis: CatalogBasis | undefined): ReportSection {
  const i = ev.input;
  const pol = FLUID_POLICY[i.fluid];
  const rows: ReportRow[] = [
    txt(tr('Látka', 'Fluid'), `${pol.formula} – ${tr(pol.name_cs, pol.name_en)}`, 'VSTUP'),
    num(tr('Špičkový návrhový průtok', 'Peak design flow'), i.flow.value, FLOW_UNIT_LABEL[i.flow.unit], 'VSTUP', 1),
  ];
  if (i.flow.unit !== 'Nm3/h') rows.push(num(tr('Špičkový průtok přepočtený', 'Peak flow converted'), toNm3h(i.flow), 'Nm³/h', 'VYPOCET', 1));
  if (i.avgFlow) rows.push(num(tr('Průměrný průtok', 'Average flow'), i.avgFlow.value, FLOW_UNIT_LABEL[i.avgFlow.unit], 'VSTUP', 1));
  rows.push(
    num(tr('Provozní tlak', 'Operating pressure'), i.pressure.value, i.pressure.kind === 'gauge' ? 'barg' : 'bar a', 'VSTUP', 3),
    num(tr('Atmosférický tlak', 'Atmospheric pressure'), i.p_atm_bar_a, 'bar a', 'VSTUP', 5),
    i.liquid.kind === 'saturated'
      ? txt(tr('Stav kapaliny', 'Liquid state'), tr('nasycená při provozním tlaku', 'saturated at operating pressure'), 'VSTUP')
      : num(tr('Teplota podchlazené kapaliny', 'Subcooled liquid temperature'), i.liquid.T_C, '°C', 'VSTUP', 1),
    num(tr('Návrhová výstupní teplota plynu', 'Design gas outlet temperature'), i.T_out_C, '°C', 'VSTUP', 1),
    num(tr('Teplota okolí pro výpočet', 'Ambient temperature for calculation'), i.T_amb_C, '°C', 'VSTUP', 1),
    i.T_min_site_C === null ? txt(tr('Min. teplota lokality', 'Min. site temperature'), tr('nezadáno', 'not set'), 'VSTUP') : num(tr('Min. teplota lokality', 'Min. site temperature'), i.T_min_site_C, '°C', 'VSTUP', 1),
    num(tr('Relativní vlhkost v zimě', 'Relative humidity in winter'), i.RH_winter_pct, '%', 'VSTUP', 0),
    i.frostWeeks === null ? txt(tr('Délka mrazového období', 'Length of frost period'), tr('nezadáno', 'not set'), 'VSTUP') : num(tr('Délka mrazového období', 'Length of frost period'), i.frostWeeks, tr('týdnů', 'weeks'), 'VSTUP', 0),
    num(tr('Min. návrhová teplota navazujícího potrubí', 'Min. design temperature of downstream piping'), i.T_pipe_min_C, '°C', 'VSTUP', 1),
    i.TSL_C === null ? txt(tr('Nastavení TSL', 'TSL setting'), tr('nezadáno', 'not set'), 'VSTUP') : num(tr('Nastavení TSL', 'TSL setting'), i.TSL_C, '°C', 'VSTUP', 1),
    num(tr('Požadovaná rezerva nad TSL', 'Required margin above TSL'), i.TSL_margin_K, 'K', 'VSTUP', 1),
    i.continuous24_7 ? txt(tr('Profil provozu', 'Operating profile'), '24/7', 'VSTUP') : num(tr('Profil provozu', 'Operating profile'), i.hoursPerDay, tr('h/den', 'h/day'), 'VSTUP', 1),
    txt(tr('Požadovaná dostupnost', 'Required availability'), i.availability === 'backup-heater' ? tr('záložní ohřívač', 'backup heater') : i.availability, 'VSTUP'),
    i.T_actual_out_C === null
      ? txt(tr('Očekávaná T_out bez dohřevu', 'Expected T_out without trim heater'), tr('nezadáno', 'not set'), 'VSTUP')
      : num(tr('Očekávaná T_out bez dohřevu', 'Expected T_out without trim heater'), i.T_actual_out_C, '°C', 'VSTUP', 1),
    txt(tr('Katalogový základ', 'Catalogue basis'), basis?.name ?? i.catalogBasisId, 'VYROBCE'),
    num(tr('Koeficient námrazy / rezervy k (násobí N_eq)', 'Frost / margin factor k (multiplies N_eq)'), i.k, '×', 'VSTUP', 2),
  );
  return { id: 'inputs', title: tr('Vstupy', 'Inputs'), rows };
}

function resultSections(ev: Evaluation, basis: CatalogBasis | undefined): ReportSection[] {
  const out: ReportSection[] = [];
  const d = ev.duty;
  const pol = FLUID_POLICY[ev.input.fluid];
  if (!d) {
    out.push({
      id: 'results',
      title: tr('Výsledek', 'Result'),
      paragraphs: [tr('Výsledek nelze zobrazit – vstupy jsou neplatné. Viz kontroly.', 'The result cannot be shown – the inputs are invalid. See the checks.'), ...(ev.error ? [ev.error] : [])],
    });
    return out;
  }
  const c = ev.consumptionPerDay!;
  const rows: ReportRow[] = [
    num(tr('Návrhový výkon Q', 'Design duty Q'), d.Q_kW, 'kW', 'VYPOCET', 3),
    num(tr('Zóna I – var (Q_I)', 'Zone I – boiling (Q_I)'), d.Q_I_kW, 'kW', 'VYPOCET', 3),
    num(tr('Zóna II – přehřátí (Q_II)', 'Zone II – superheating (Q_II)'), d.Q_II_kW, 'kW', 'VYPOCET', 3),
    num(tr('Q pro nasycenou kapalinu (minimum)', 'Q for saturated liquid (minimum)'), d.Q_sat_kW, 'kW', 'VYPOCET', 3),
    num(tr('Hmotnostní průtok ṁ', 'Mass flow ṁ'), d.m_kg_h, 'kg/h', 'VYPOCET', 2),
    num(tr('Použitý absolutní tlak', 'Absolute pressure used'), d.p_bar_a, 'bar a', 'VYPOCET', 5),
    num(tr(`Spotřeba ${pol.liquidLabel} za den (${fmt(c.hours, 0)} h)`, `${pol.liquidLabel} consumption per day (${fmt(c.hours, 0)} h)`), c.mass_kg, 'kg', 'VYPOCET', 0),
    num(tr(`Spotřeba ${pol.liquidLabel} za den – objem při stavu na vstupu`, `${pol.liquidLabel} consumption per day – volume at inlet state`), c.volume_m3, 'm³', 'VYPOCET', 2),
    ...(c.volume_nbp_m3 !== null
      ? [num(tr(`Spotřeba ${pol.liquidLabel} za den – objem jako kapalina při 1,01325 bar`, `${pol.liquidLabel} consumption per day – volume as liquid at 1.01325 bar`), c.volume_nbp_m3, 'm³', 'VYPOCET', 2)]
      : []),
  ];
  if (ev.reheat?.ok) rows.push(num(tr('Výkon dohřevu', 'Trim heater duty'), ev.reheat.Q_kW, 'kW', 'VYPOCET', 3));
  else if (ev.reheat) rows.push(txt(tr('Výkon dohřevu', 'Trim heater duty'), ev.reheat.reason, 'VYPOCET'));
  out.push({ id: 'results', title: tr('Výsledek – tepelná potřeba', 'Result – heat duty'), rows });

  out.push({
    id: 'steps',
    title: tr('Mezihodnoty výpočtu', 'Intermediate values'),
    rows: [
      num('ρn (0 °C; 1,01325 bar)', d.rho_n_kg_Nm3, 'kg/Nm³', 'VYPOCET', 6),
      num('T_sat(p)', d.T_sat_C, '°C', 'VYPOCET', 3),
      num('h_l,sat', d.h_l_sat_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_v,sat', d.h_v_sat_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('r = h_v,sat − h_l,sat', d.r_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_in', d.h_in_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_out', d.h_out_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num(tr('q₁ ohřev kapaliny', 'q₁ liquid warming'), d.q1_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num(tr('q₂ výparné teplo', 'q₂ latent heat'), d.q2_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num(tr('q₃ přehřátí', 'q₃ superheating'), d.q3_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
    ],
    paragraphs: [
      `Vlastnosti: ${getProvider(ev.input.fluid).meta.eos ?? ''}, CoolProp ${getProvider(ev.input.fluid).meta.coolprop_version}. ` +
        tr('Referenční stav h = 0 pro nasycenou kapalinu při 1,01325 bar. Tlaková ztráta zanedbána (0,5 bar tlakové ztráty by zvýšilo výkon o +0,05 až +0,15 % podle tlaku a T_out).', 'Reference state h = 0 for saturated liquid at 1.01325 bar. Pressure drop neglected (0.5 bar of pressure drop would raise the duty by +0.05 to +0.15 % depending on pressure and T_out).'),
    ],
  });

  const s = ev.sizing;
  if (s) {
    if (!s.ok) out.push({ id: 'sizing', title: tr('Posouzení velikosti – ideální dolní mez', 'Sizing assessment – ideal lower bound'), paragraphs: [s.reason] });
    else
      out.push({
        id: 'sizing',
        title: tr('Posouzení velikosti – IDEÁLNÍ DOLNÍ MEZ (model konstantního U)', 'Sizing assessment – IDEAL LOWER BOUND (constant-U model)'),
        rows: [
          num(tr('T_des = MIN(T_okolí, T_min)', 'T_des = MIN(T_ambient, T_min)'), s.ua.T_des_C, '°C', 'VYPOCET', 1),
          num('ΔT_I', s.ua.dT_I_K, 'K', 'VYPOCET', 2),
          num('ΔT_out', s.ua.dT_out_K, 'K', 'VYPOCET', 2),
          num('LMTD_II', s.ua.LMTD_II_K, 'K', 'VYPOCET', 2),
          num(tr('UA_potř', 'UA_req'), s.ua.UA_W_K / 1000, 'kW/K', 'VYPOCET', 3),
          txt(tr('Katalogový základ', 'Catalogue basis'), basis?.name ?? s.basisId, 'VYROBCE'),
          num(tr('UA₁ (na 1 Nm³/h, katalogové podmínky)', 'UA₁ (per 1 Nm³/h, catalogue conditions)'), s.ua1.UA1_W_K_per_Nm3h, 'W/K na Nm³/h', 'VYPOCET', 4),
          num(tr('Ideální ekvivalent N_eq', 'Ideal equivalent N_eq'), s.N_eq_Nm3_h, tr(`Nm³/h (${pol.catalogColumn}, kat. základ)`, `Nm³/h (${pol.catalogColumn}, cat. basis)`), 'VYPOCET', 1),
          num(tr('Koeficient k (násobí N_eq)', 'Factor k (multiplies N_eq)'), s.k, '×', 'VSTUP', 2),
          num(tr('Tepelná náročnost N_eq·k/V̇n', 'Thermal demand N_eq·k/V̇n'), s.thermalDemand, tr('× průtoku', '× flow'), 'VYPOCET', 3),
          num(tr('Nejmenší jmenovitá kapacita větve (dolní hranice, NE doporučený model)', 'Minimum rated branch capacity (lower bound, NOT a recommended model)'), s.minBranchCapacity_Nm3_h, 'Nm³/h', 'VYPOCET', 0),
        ],
        bullets: [...s.warnings],
      });
  }
  if (ev.concept) {
    out.push({
      id: 'concept',
      title: tr('Doporučení konceptu (PRAXE)', 'Concept recommendation (PRACTICE)'),
      table: {
        head: [tr('Koncept', 'Concept'), tr('Role', 'Role'), tr('Proč', 'Why')],
        body: ev.concept.items.map((it) => [concepts()[it.id].name, roleLabel(it.role), it.why.join(' ')]),
        widths: [2.6, 1.7, 6],
      },
      paragraphs: ev.concept.threeVariants
        ? [
            `${tr('Zvaž tři varianty:', 'Consider three variants:')} ${ev.concept.threeVariants.why} ` +
              ev.concept.threeVariants.variants.map((v) => `(${v.key}) ${v.text}`).join('; ') +
              `. ${ev.concept.threeVariants.note}`,
          ]
        : [],
      bullets: ev.concept.notes,
    });
  }
  return out;
}

function checksSection(ev: Evaluation): ReportSection {
  return {
    id: 'checks',
    title: tr('Kontroly K1–K8 a doplňkové D1–D4', 'Checks K1–K8 and additional D1–D4'),
    table: {
      head: [tr('Kontrola', 'Check'), tr('Stav', 'Status'), tr('Vysvětlení', 'Explanation'), tr('Norma', 'Standard')],
      body: ev.checks.map((c) => [`${c.id} ${c.title}`, levelText(c.level), c.message, c.reference ?? '']),
      widths: [2.6, 1.9, 6, 1.4],
    },
  };
}

function warningsSection(ev: Evaluation): ReportSection {
  const bullets = [
    `${tr('Stav výsledku', 'Result status')}: ${ev.statusText}.`,
    ...ev.checks
      .filter((c) => c.level === 'POZOR' || c.level === 'CHYBA' || c.level === 'NEZADÁNO')
      .map((c) => `${c.id} ${levelText(c.level)}: ${c.message}`),
    tr('Výkon v kW je fyzika. Atmosférický odpařovač se nevybírá podle kW, ale podle průtoku v Nm³/h, minimální teploty okolí, vlhkosti a profilu provozu.', 'Duty in kW is physics. An ambient vaporizer is not selected by kW but by the flow in Nm³/h, the minimum ambient temperature, humidity and the operating profile.'),
    tr('Posouzení velikosti je ideální dolní mez (model konstantního U) – OPTIMISTICKÉ. Nikdy nejde o doporučený model.', 'The sizing assessment is an ideal lower bound (constant-U model) – OPTIMISTIC. It is never a recommended model.'),
    tr('Kontroly jsou statická kontrola konzistence návrhových teplot – nenahrazují HAZOP / LOPA, ověření SIL ani projekt.', 'The checks are a static consistency check of design temperatures – they do not replace HAZOP / LOPA, SIL verification or the engineering design.'),
    disclaimer(),
  ];
  return { id: 'warnings', title: tr('Upozornění', 'Warnings'), bullets };
}

function inquirySection(ev: Evaluation, basis: CatalogBasis | undefined, overrides: InquiryOverrides): ReportSection[] {
  const items = buildInquiry(ev, basis);
  const sections: ReportSection[] = items.map((it) => ({
    id: `inq-${it.id}`,
    title: it.title,
    paragraphs: [`${tr('Proč to potřebujeme od výrobce', 'Why we need this from the manufacturer')}: ${it.why}`],
    rows: it.fields.map((f) => {
      const v = fieldValue(f, overrides);
      return txt(f.label, v.trim() === '' ? tr('— doplnit —', '— to fill in —') : v, overrides[f.key] !== undefined ? 'VSTUP' : f.source);
    }),
  }));
  const mism = checkInquiry(items, overrides);
  const missing = missingInquiryFields(items, overrides);
  sections.push({
    id: 'inq-check',
    title: tr('Kontrola poptávky', 'Enquiry check'),
    bullets: [
      mism.length
        ? tr(`Poptávka se liší od vstupů výpočtu v ${mism.length} polích: ${mism.map((m) => m.label).join('; ')}.`, `The enquiry differs from the calculation inputs in ${mism.length} fields: ${mism.map((m) => m.label).join('; ')}.`)
        : tr('Svázaná pole poptávky odpovídají vstupům výpočtu.', 'Linked enquiry fields match the calculation inputs.'),
      missing.length ? tr(`Nevyplněno: ${missing.join('; ')}.`, `Not filled in: ${missing.join('; ')}.`) : tr('Všechna pole k doplnění jsou vyplněna.', 'All fields to fill in are filled.'),
    ],
  });
  return sections;
}

export function buildReport(ev: Evaluation, opts: ReportOptions): ReportModel {
  const now = opts.now ?? new Date();
  const pol = FLUID_POLICY[ev.input.fluid];
  const meta = getProvider(ev.input.fluid).meta;
  const createdText = new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'cs-CZ', { dateStyle: 'long', timeStyle: 'short' }).format(now);
  const base = {
    appVersion: opts.appVersion,
    coolpropVersion: meta.coolprop_version,
    createdIso: now.toISOString(),
    createdText,
    status: ev.statusText,
    disclaimer: disclaimer(),
  };
  if (opts.kind === 'inquiry') {
    return {
      ...base,
      kind: 'inquiry',
      title: tr(`Poptávka – atmosférický odpařovač ${pol.liquidLabel}`, `Enquiry – ambient vaporizer ${pol.liquidLabel}`),
      subtitle: tr(`${pol.formula}, ${fmt(toNm3h(ev.input.flow), 0)} Nm³/h (špička). Požadujeme výběr a garanci výrobce přepočtem na lokalitu.`, `${pol.formula}, ${fmt(toNm3h(ev.input.flow), 0)} Nm³/h (peak). We require the manufacturer’s selection and guarantee by re-rating to the site.`),
      sections: inquirySection(ev, opts.basis, opts.inquiry),
    };
  }
  return {
    ...base,
    kind: 'report',
    title: tr(`Výpočet atmosférického odpařovače ${pol.liquidLabel}`, `Ambient vaporizer calculation ${pol.liquidLabel}`),
    subtitle: tr(`${pol.formula} – tepelná potřeba, kontroly bezpečnosti a ideální dolní mez velikosti`, `${pol.formula} – heat duty, safety checks and ideal lower bound of size`),
    sections: [
      inputsSection(ev, opts.basis),
      ...resultSections(ev, opts.basis),
      checksSection(ev),
      warningsSection(ev),
      ...inquirySection(ev, opts.basis, opts.inquiry).map((s) => ({ ...s, title: `${tr('Poptávka', 'Enquiry')}: ${s.title}` })),
    ],
  };
}

export function reportFileName(model: ReportModel, ext: string): string {
  const d = model.createdIso.slice(0, 10);
  return `${model.kind === 'inquiry' ? tr('poptavka', 'enquiry') : tr('odparovac', 'vaporizer')}_${d}.${ext}`;
}
