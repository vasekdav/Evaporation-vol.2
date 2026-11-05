/**
 * Model reportu – jediný zdroj obsahu pro PDF i Excel. Čistá funkce nad výsledkem
 * výpočtu. Každá hodnota nese jednotku a původ (VÝPOČET / PRAXE / ÚDAJ VÝROBCE / VSTUP).
 */
import type { CatalogBasis } from '../core/catalog';
import { CONCEPTS } from '../core/concept';
import type { Evaluation } from '../core/evaluate';
import { FLUID_POLICY } from '../core/fluids';
import { fmt } from '../core/format';
import { buildInquiry, checkInquiry, fieldValue, missingInquiryFields, type InquiryOverrides } from '../core/inquiry';
import { getProvider } from '../core/properties';
import { FLOW_PER_NM3, toNm3h } from '../core/units';

export type RowSource = 'VYPOCET' | 'PRAXE' | 'VYROBCE' | 'VSTUP' | 'DOPLNIT' | '';

export const SOURCE_SHORT: Record<RowSource, string> = {
  VYPOCET: 'VÝPOČET',
  PRAXE: 'PRAXE',
  VYROBCE: 'VÝROBCE',
  VSTUP: 'VSTUP',
  DOPLNIT: 'DOPLNIT',
  '': '',
};

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

export const DISCLAIMER =
  'Aplikace není náhradou výběru a garance výrobce. Velikost odpařovače vždy potvrzuje výrobce přepočtem na konkrétní lokalitu.';

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
    txt('Látka', `${pol.formula} – ${pol.name_cs}`, 'VSTUP'),
    num('Špičkový návrhový průtok', i.flow.value, FLOW_UNIT_LABEL[i.flow.unit], 'VSTUP', 1),
  ];
  if (i.flow.unit !== 'Nm3/h') rows.push(num('Špičkový průtok přepočtený', toNm3h(i.flow), 'Nm³/h', 'VYPOCET', 1));
  if (i.avgFlow) rows.push(num('Průměrný průtok', i.avgFlow.value, FLOW_UNIT_LABEL[i.avgFlow.unit], 'VSTUP', 1));
  rows.push(
    num('Provozní tlak', i.pressure.value, i.pressure.kind === 'gauge' ? 'barg' : 'bar a', 'VSTUP', 3),
    num('Atmosférický tlak', i.p_atm_bar_a, 'bar a', 'VSTUP', 5),
    i.liquid.kind === 'saturated'
      ? txt('Stav kapaliny', 'nasycená při provozním tlaku', 'VSTUP')
      : num('Teplota podchlazené kapaliny', i.liquid.T_C, '°C', 'VSTUP', 1),
    num('Návrhová výstupní teplota plynu', i.T_out_C, '°C', 'VSTUP', 1),
    num('Teplota okolí pro výpočet', i.T_amb_C, '°C', 'VSTUP', 1),
    i.T_min_site_C === null ? txt('Min. teplota lokality', 'nezadáno', 'VSTUP') : num('Min. teplota lokality', i.T_min_site_C, '°C', 'VSTUP', 1),
    num('Relativní vlhkost v zimě', i.RH_winter_pct, '%', 'VSTUP', 0),
    i.frostWeeks === null ? txt('Délka mrazového období', 'nezadáno', 'VSTUP') : num('Délka mrazového období', i.frostWeeks, 'týdnů', 'VSTUP', 0),
    num('Min. návrhová teplota navazujícího potrubí', i.T_pipe_min_C, '°C', 'VSTUP', 1),
    i.TSL_C === null ? txt('Nastavení TSL', 'nezadáno', 'VSTUP') : num('Nastavení TSL', i.TSL_C, '°C', 'VSTUP', 1),
    num('Požadovaná rezerva nad TSL', i.TSL_margin_K, 'K', 'VSTUP', 1),
    i.continuous24_7 ? txt('Profil provozu', '24/7', 'VSTUP') : num('Profil provozu', i.hoursPerDay, 'h/den', 'VSTUP', 1),
    txt('Požadovaná dostupnost', i.availability === 'backup-heater' ? 'záložní ohřívač' : i.availability, 'VSTUP'),
    i.T_actual_out_C === null
      ? txt('Očekávaná T_out bez dohřevu', 'nezadáno', 'VSTUP')
      : num('Očekávaná T_out bez dohřevu', i.T_actual_out_C, '°C', 'VSTUP', 1),
    txt('Katalogový základ', basis?.name ?? i.catalogBasisId, 'VYROBCE'),
    num('Koeficient námrazy / rezervy k', i.k, '–', 'VSTUP', 2),
  );
  return { id: 'inputs', title: 'Vstupy', rows };
}

function resultSections(ev: Evaluation, basis: CatalogBasis | undefined): ReportSection[] {
  const out: ReportSection[] = [];
  const d = ev.duty;
  const pol = FLUID_POLICY[ev.input.fluid];
  if (!d) {
    out.push({
      id: 'results',
      title: 'Výsledek',
      paragraphs: ['Výsledek nelze zobrazit – vstupy jsou neplatné. Viz kontroly.', ...(ev.error ? [ev.error] : [])],
    });
    return out;
  }
  const c = ev.consumptionPerDay!;
  const rows: ReportRow[] = [
    num('Návrhový výkon Q', d.Q_kW, 'kW', 'VYPOCET', 3),
    num('Zóna I – var (Q_I)', d.Q_I_kW, 'kW', 'VYPOCET', 3),
    num('Zóna II – přehřátí (Q_II)', d.Q_II_kW, 'kW', 'VYPOCET', 3),
    num('Q pro nasycenou kapalinu (minimum)', d.Q_sat_kW, 'kW', 'VYPOCET', 3),
    num('Hmotnostní průtok ṁ', d.m_kg_h, 'kg/h', 'VYPOCET', 2),
    num('Použitý absolutní tlak', d.p_bar_a, 'bar a', 'VYPOCET', 5),
    num(`Spotřeba ${pol.liquidLabel} za den (${fmt(c.hours, 0)} h)`, c.mass_kg, 'kg', 'VYPOCET', 0),
    num(`Spotřeba ${pol.liquidLabel} za den – objem`, c.volume_m3, 'm³', 'VYPOCET', 2),
  ];
  if (ev.reheat?.ok) rows.push(num('Výkon dohřevu', ev.reheat.Q_kW, 'kW', 'VYPOCET', 3));
  else if (ev.reheat) rows.push(txt('Výkon dohřevu', ev.reheat.reason, 'VYPOCET'));
  out.push({ id: 'results', title: 'Výsledek – tepelná potřeba', rows });

  out.push({
    id: 'steps',
    title: 'Mezihodnoty výpočtu',
    rows: [
      num('ρn (0 °C; 1,01325 bar)', d.rho_n_kg_Nm3, 'kg/Nm³', 'VYPOCET', 6),
      num('T_sat(p)', d.T_sat_C, '°C', 'VYPOCET', 3),
      num('h_l,sat', d.h_l_sat_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_v,sat', d.h_v_sat_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('r = h_v,sat − h_l,sat', d.r_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_in', d.h_in_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('h_out', d.h_out_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('q₁ ohřev kapaliny', d.q1_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('q₂ výparné teplo', d.q2_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
      num('q₃ přehřátí', d.q3_kJ_kg, 'kJ/kg', 'VYPOCET', 3),
    ],
    paragraphs: [
      `Vlastnosti: ${getProvider(ev.input.fluid).meta.eos ?? ''}, CoolProp ${getProvider(ev.input.fluid).meta.coolprop_version}. ` +
        'Referenční stav h = 0 pro nasycenou kapalinu při 1,01325 bar. Tlaková ztráta zanedbána (0,5 bar ≈ +0,05 % výkonu).',
    ],
  });

  const s = ev.sizing;
  if (s) {
    if (!s.ok) out.push({ id: 'sizing', title: 'Posouzení velikosti – ideální dolní mez', paragraphs: [s.reason] });
    else
      out.push({
        id: 'sizing',
        title: 'Posouzení velikosti – IDEÁLNÍ DOLNÍ MEZ (model konstantního U)',
        rows: [
          num('T_des = MIN(T_okolí, T_min)', s.ua.T_des_C, '°C', 'VYPOCET', 1),
          num('ΔT_I', s.ua.dT_I_K, 'K', 'VYPOCET', 2),
          num('ΔT_out', s.ua.dT_out_K, 'K', 'VYPOCET', 2),
          num('LMTD_II', s.ua.LMTD_II_K, 'K', 'VYPOCET', 2),
          num('UA_potř', s.ua.UA_W_K / 1000, 'kW/K', 'VYPOCET', 3),
          txt('Katalogový základ', basis?.name ?? s.basisId, 'VYROBCE'),
          num('UA₁ (na 1 Nm³/h, katalogové podmínky)', s.ua1.UA1_W_K_per_Nm3h, 'W/K na Nm³/h', 'VYPOCET', 4),
          num('Ideální ekvivalent N_eq', s.N_eq_Nm3_h, `Nm³/h (${pol.catalogColumn}, kat. základ)`, 'VYPOCET', 1),
          num('Koeficient k', s.k, '–', 'VSTUP', 2),
          num('Tepelná náročnost N_eq·k/V̇n', s.thermalDemand, '–', 'VYPOCET', 3),
          num('Nejmenší jmenovitá kapacita větve (dolní hranice, NE doporučený model)', s.minBranchCapacity_Nm3_h, 'Nm³/h', 'VYPOCET', 0),
        ],
        bullets: [...s.warnings],
      });
  }
  if (ev.concept) {
    out.push({
      id: 'concept',
      title: 'Doporučení konceptu (PRAXE)',
      table: {
        head: ['Koncept', 'Role', 'Proč'],
        body: ev.concept.items.map((it) => [CONCEPTS[it.id].name, it.role, it.why.join(' ')]),
        widths: [2.6, 1.7, 6],
      },
      paragraphs: ev.concept.threeVariants
        ? [
            `Zvaž tři varianty: ${ev.concept.threeVariants.why} ` +
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
    title: 'Kontroly K1–K8 a doplňkové D1–D4',
    table: {
      head: ['Kontrola', 'Stav', 'Vysvětlení', 'Norma'],
      body: ev.checks.map((c) => [`${c.id} ${c.title}`, c.level, c.message, c.reference ?? '']),
      widths: [2.6, 1.3, 6, 1.4],
    },
  };
}

function warningsSection(ev: Evaluation): ReportSection {
  const bullets = [
    `Stav výsledku: ${ev.statusText}.`,
    ...ev.checks.filter((c) => c.level === 'POZOR' || c.level === 'CHYBA').map((c) => `${c.id} ${c.level}: ${c.message}`),
    'Výkon v kW je fyzika. Atmosférický odpařovač se nevybírá podle kW, ale podle průtoku v Nm³/h, minimální teploty okolí, vlhkosti a profilu provozu.',
    'Posouzení velikosti je ideální dolní mez (model konstantního U) – OPTIMISTICKÉ. Nikdy nejde o doporučený model.',
    DISCLAIMER,
  ];
  return { id: 'warnings', title: 'Upozornění', bullets };
}

function inquirySection(ev: Evaluation, basis: CatalogBasis | undefined, overrides: InquiryOverrides): ReportSection[] {
  const items = buildInquiry(ev, basis);
  const sections: ReportSection[] = items.map((it) => ({
    id: `inq-${it.id}`,
    title: it.title,
    paragraphs: [`Proč to potřebujeme od výrobce: ${it.why}`],
    rows: it.fields.map((f) => {
      const v = fieldValue(f, overrides);
      return txt(f.label, v.trim() === '' ? '— doplnit —' : v, overrides[f.key] !== undefined ? 'VSTUP' : f.source);
    }),
  }));
  const mism = checkInquiry(items, overrides);
  const missing = missingInquiryFields(items, overrides);
  sections.push({
    id: 'inq-check',
    title: 'Kontrola poptávky',
    bullets: [
      mism.length
        ? `Poptávka se liší od vstupů výpočtu v ${mism.length} polích: ${mism.map((m) => m.label).join('; ')}.`
        : 'Svázaná pole poptávky odpovídají vstupům výpočtu.',
      missing.length ? `Nevyplněno: ${missing.join('; ')}.` : 'Všechna pole k doplnění jsou vyplněna.',
    ],
  });
  return sections;
}

export function buildReport(ev: Evaluation, opts: ReportOptions): ReportModel {
  const now = opts.now ?? new Date();
  const pol = FLUID_POLICY[ev.input.fluid];
  const meta = getProvider(ev.input.fluid).meta;
  const createdText = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeStyle: 'short' }).format(now);
  const base = {
    appVersion: opts.appVersion,
    coolpropVersion: meta.coolprop_version,
    createdIso: now.toISOString(),
    createdText,
    status: ev.statusText,
    disclaimer: DISCLAIMER,
  };
  if (opts.kind === 'inquiry') {
    return {
      ...base,
      kind: 'inquiry',
      title: `Poptávka – atmosférický odpařovač ${pol.liquidLabel}`,
      subtitle: `${pol.formula}, ${fmt(toNm3h(ev.input.flow), 0)} Nm³/h (špička). Požadujeme výběr a garanci výrobce přepočtem na lokalitu.`,
      sections: inquirySection(ev, opts.basis, opts.inquiry),
    };
  }
  return {
    ...base,
    kind: 'report',
    title: `Výpočet atmosférického odpařovače ${pol.liquidLabel}`,
    subtitle: `${pol.formula} – tepelná potřeba, kontroly bezpečnosti a ideální dolní mez velikosti`,
    sections: [
      inputsSection(ev, opts.basis),
      ...resultSections(ev, opts.basis),
      checksSection(ev),
      warningsSection(ev),
      ...inquirySection(ev, opts.basis, opts.inquiry).map((s) => ({ ...s, title: `Poptávka: ${s.title}` })),
    ],
  };
}

export function reportFileName(model: ReportModel, ext: string): string {
  const d = model.createdIso.slice(0, 10);
  return `${model.kind === 'inquiry' ? 'poptavka' : 'odparovac'}_${d}.${ext}`;
}
