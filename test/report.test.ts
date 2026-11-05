/** Fáze 4 – poptávka, report (PDF, XLSX), uložení případu a sdílitelný odkaz. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  buildInquiry,
  checkInquiry,
  defaultInput,
  evaluate,
  fieldValue,
  findBasis,
  missingInquiryFields,
  type CatalogBasis,
  type DesignInput,
} from '../src/core';
import { caseFromParam, caseToParam, makeCase, parseCase, shareUrl } from '../src/report/caseFile';
import { buildReport, type ReportModel } from '../src/report/model';
import { buildPdfDefinition, renderPdf } from '../src/report/pdf';
import { fillWorkbook } from '../src/report/xlsx';

const NOW = new Date('2026-11-04T10:00:00Z');
const chart = findBasis('chart-supergap-eu');

function models(input: DesignInput, inquiry: Record<string, string> = {}) {
  const ev = evaluate(input);
  const opts = { basis: chart, inquiry, appVersion: '9.9.9', now: NOW };
  return {
    ev,
    report: buildReport(ev, { ...opts, kind: 'report' }),
    inquiry: buildReport(ev, { ...opts, kind: 'inquiry' }),
  };
}

const allText = (m: ReportModel) =>
  JSON.stringify(m.sections) + m.title + m.subtitle + m.appVersion + m.createdText + m.disclaimer + m.status;

describe('generátor poptávky', () => {
  it('O₂: všechny položky kap. 8 bod 8, kyslíková čistota, předvyplněno ze vstupů', () => {
    const ev = evaluate(defaultInput('O2'));
    const items = buildInquiry(ev, chart);
    const f0 = (k: string) => items.flatMap((i) => i.fields).find((x) => x.key === k)!;
    expect(items.map((i) => i.id)).toEqual([
      'project',
      'source',
      'ped',
      'connections',
      'relief',
      'dp',
      'guarantee',
      'protection',
      'switching',
      'loads',
      'cleanliness',
      'install',
      'docs',
    ]);
    // doplněno po nezávislé kontrole (praxe, bezpečnost)
    expect(f0('relief.req').prefill).toContain('pojistné ventily');
    expect(f0('prot.req').prefill).toContain('doba zavření'.replace('doba', 'dobu'));
    expect(f0('guar.sentence').prefill).toContain('na jednu provozní větev');
    expect(f0('guar.cycle').prefill).toBe('8 h od startu z odmraženého stavu');
    expect(f0('clean.valves').prefill).toContain('adiabatická komprese');
    expect(f0('inst.ground').prefill).toContain('bez asfaltu');
    expect(f0('ped.national').prefill).toContain('250/2021');
    for (const it of items) expect(it.why.length).toBeGreaterThan(20);
    const f = (k: string) => items.flatMap((i) => i.fields).find((x) => x.key === k)!;
    expect(f('guar.peak').prefill).toBe('1 000 Nm³/h (špička)'.replace(' ', ' '));
    expect(f('guar.tout').prefill).toContain('−30 °C'); // typografické minus
    expect(f('source.pressure').prefill).toContain('5,00 barg');
    expect(f('clean.req').prefill).toContain('EIGA Doc 33');
    expect(f('ped.group').prefill).toContain('skupina 1');
    expect(f('docs.list').prefill).toContain('EN 10204 3.1');
    expect(f('docs.list').prefill).toContain('v češtině');
    expect(f('guar.info').prefill).toContain('požadujeme přepočet výrobce');
  });
  it('N₂: běžná čistota, skupina 2; 24/7 → přepínání požadováno; N+1', () => {
    const ev = evaluate({ ...defaultInput('N2'), continuous24_7: true, availability: 'N+1' });
    const fields = buildInquiry(ev, chart).flatMap((i) => i.fields);
    const f = (k: string) => fields.find((x) => x.key === k)!;
    expect(f('clean.req').prefill).toBe('běžná čistota pro kryogenní službu');
    expect(f('ped.group').prefill).toContain('skupina 2');
    expect(f('sw.scope').prefill).toMatch(/^požadováno/);
    expect(f('project.branches').prefill).toContain('N+1');
    expect(f('guar.profile').prefill).toBe('nepřetržitě 24/7');
  });
  it('kontrola shody: přepsané svázané pole jinak než vstup → nesoulad; pole k doplnění se hlásí', () => {
    const ev = evaluate(defaultInput('O2'));
    const items = buildInquiry(ev, chart);
    expect(checkInquiry(items, {})).toEqual([]);
    // stejné hodnoty jinak napsané nejsou nesoulad
    const peak = items.flatMap((i) => i.fields).find((x) => x.key === 'guar.peak')!;
    expect(checkInquiry(items, { 'guar.peak': ` ${peak.prefill.toUpperCase()} ` })).toEqual([]);
    const m = checkInquiry(items, { 'guar.peak': '800 Nm³/h', 'project.site': 'Kladno' });
    expect(m).toHaveLength(1);
    expect(m[0]!.key).toBe('guar.peak');
    expect(missingInquiryFields(items, {})).toContain('Identifikace a rozsah – Lokalita (adresa, nadmořská výška)');
    expect(missingInquiryFields(items, { 'project.site': 'Kladno' })).not.toContain(
      'Identifikace a rozsah – Lokalita (adresa, nadmořská výška)',
    );
    expect(fieldValue(peak, { 'guar.peak': 'x' })).toBe('x');
  });
  it('změna vstupu po úpravě pole → nesoulad', () => {
    const items1 = buildInquiry(evaluate(defaultInput('O2')), chart);
    const prefill = items1.flatMap((i) => i.fields).find((f) => f.key === 'guar.tout')!.prefill;
    const items2 = buildInquiry(evaluate({ ...defaultInput('O2'), T_out_C: -20 }), chart);
    expect(checkInquiry(items2, { 'guar.tout': prefill }).map((x) => x.key)).toEqual(['guar.tout']);
  });
});

describe('model reportu', () => {
  it('obsahuje vstupy, výsledky, kontroly, upozornění, verzi aplikace a datum', () => {
    const { report } = models(defaultInput('O2'));
    const ids = report.sections.map((s) => s.id);
    for (const id of ['inputs', 'results', 'steps', 'sizing', 'concept', 'checks', 'warnings']) expect(ids).toContain(id);
    expect(report.appVersion).toBe('9.9.9');
    expect(report.createdIso).toBe('2026-11-04T10:00:00.000Z');
    expect(report.createdText).toContain('2026');
    expect(report.coolpropVersion).toBe('7.2.0');
    const Q = report.sections.find((s) => s.id === 'results')!.rows!.find((r) => r.label === 'Návrhový výkon Q')!;
    expect(Q.num).toBeCloseTo(139.711, 2);
    expect(Q.text).toBe('139,711');
    expect(Q.unit).toBe('kW');
    expect(Q.source).toBe('VYPOCET');
    // každý řádek má jednotku nebo je textový, a vždy původ
    for (const s of report.sections) for (const r of s.rows ?? []) expect(r.source).not.toBe('');
    expect(report.sections.find((s) => s.id === 'checks')!.table!.body).toHaveLength(12);
    const w = report.sections.find((s) => s.id === 'warnings')!.bullets!.join(' ');
    expect(w).toContain('není náhradou výběru a garance výrobce');
    expect(w).toContain('OPTIMISTICKÉ');
    expect(allText(report)).toContain('NE doporučený model');
  });
  it('neplatné vstupy: report bez výkonu, ale s kontrolami', () => {
    const { report } = models({ ...defaultInput('N2'), pressure: { value: 35, kind: 'abs' } });
    expect(report.status).toBe('NEPLATNÉ – oprav vstupy');
    expect(report.sections.find((s) => s.id === 'results')!.rows).toBeUndefined();
    expect(JSON.stringify(report.sections.find((s) => s.id === 'checks'))).toContain('nad kritickým tlakem dusíku');
  });
  it('poptávka jako samostatný dokument s kontrolou shody', () => {
    const { inquiry } = models(defaultInput('O2'), { 'guar.peak': '800 Nm³/h' });
    expect(inquiry.kind).toBe('inquiry');
    const check = inquiry.sections.find((s) => s.id === 'inq-check')!.bullets!.join(' ');
    expect(check).toContain('liší od vstupů výpočtu v 1 polích');
    expect(allText(inquiry)).toContain('Kyslíková čistota');
  });
});

describe('PDF', () => {
  it('definice dokumentu: zápatí s verzí, datem a upozorněním', () => {
    const { report } = models(defaultInput('O2'));
    const def = buildPdfDefinition(report);
    const footer = (def.footer as (p: number, c: number) => { text: string })(1, 2).text;
    expect(footer).toContain('9.9.9');
    expect(footer).toContain('2026');
    expect(footer).toContain('není náhradou');
  });
  it('vygenerované PDF obsahuje české texty a výsledky', async () => {
    const { report } = models(defaultInput('O2'));
    const bytes = await renderPdf(report);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    let text = '';
    try {
      const dir = mkdtempSync(join(tmpdir(), 'odp-'));
      const f = join(dir, 'r.pdf');
      writeFileSync(f, bytes);
      text = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf-8' });
    } catch {
      return; // pdftotext není k dispozici – ověřena aspoň hlavička
    }
    expect(text).toContain('Výpočet atmosférického odpařovače LOX');
    expect(text).toContain('139,711');
    expect(text).toContain('Kontroly K1–K8');
    expect(text).toContain('Verze aplikace');
    expect(text).toContain('IDEÁLNÍ DOLNÍ MEZ');
    expect(text).toMatch(/Kyslíková\s+čistota/);
    // znaky, které písmo nemá, se v PDF nahrazují (jinak prázdný rámeček)
    expect(text).not.toContain('ṁ');
    expect(text).toContain('N_eq·k/Vn');
  }, 30000);
});

describe('Excel', () => {
  it('listy Vstupy, Výsledky, Kontroly, Poptávka; čísla jako čísla', async () => {
    const { report, inquiry } = models(defaultInput('O2'));
    const wb = fillWorkbook(new ExcelJS.Workbook(), report, inquiry);
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    expect(back.worksheets.map((w) => w.name)).toEqual(['Info', 'Vstupy', 'Výsledky', 'Kontroly', 'Koncept', 'Poptávka']);
    const find = (sheet: string, label: string) => {
      let v: unknown;
      back.getWorksheet(sheet)!.eachRow((row) => {
        if (row.getCell(2).value === label) v = row.getCell(3).value;
      });
      return v;
    };
    expect(find('Vstupy', 'Špičkový návrhový průtok')).toBe(1000);
    expect(find('Výsledky', 'Návrhový výkon Q') as number).toBeCloseTo(139.711, 2);
    expect(back.getWorksheet('Kontroly')!.rowCount).toBe(13);
    expect(String(back.getWorksheet('Info')!.getCell('B2').value)).toBe('9.9.9');
    let inq = '';
    back.getWorksheet('Poptávka')!.eachRow((r) => (inq += ` ${String(r.getCell(2).value)} ${String(r.getCell(3).value)}`));
    expect(inq).toContain('Garantovaný průtok');
    expect(inq).toContain('EIGA Doc 33');
  });
});

describe('uložení případu a sdílitelný odkaz', () => {
  const own: CatalogBasis = { ...findBasis('chart-supergap-eu')!, id: 'own-x', name: 'Můj základ', pressure: { value: 16.01325, kind: 'abs' } };
  const input: DesignInput = { ...defaultInput('N2'), T_amb_C: -15, T_out_C: -25, TSL_C: -28, catalogBasisId: 'own-x' };

  it('JSON: uložený případ se po načtení přepočítá na stejná čísla', () => {
    const json = JSON.stringify(makeCase(input, [own], { 'project.site': 'Ostrava' }, '9.9.9', NOW));
    const p = parseCase(json);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.input).toEqual(input);
    expect(p.customBasis?.name).toBe('Můj základ');
    expect(p.inquiry).toEqual({ 'project.site': 'Ostrava' });
    const a = evaluate(input, { extraBases: [own] });
    const b = evaluate(p.input, { extraBases: [p.customBasis!] });
    expect(b.duty!.Q_kW).toBe(a.duty!.Q_kW);
    expect(b.sizing).toEqual(a.sizing);
    expect(b.statusText).toBe(a.statusText);
  });
  it('sdílitelný odkaz: tam a zpět, včetně diakritiky', () => {
    const c = makeCase(input, [own], { 'project.site': 'Ústí nad Labem – areál č. 3' }, '9.9.9', NOW);
    const url = shareUrl(c, 'https://example.org/app/index.html#overeni');
    const u = new URL(url);
    // data ve fragmentu (#case=…) – neposílají se na server
    expect(u.search).toBe('');
    expect(u.hash.startsWith('#case=')).toBe(true);
    const param = u.hash.slice('#case='.length);
    expect(param).toBe(caseToParam(c));
    const p = caseFromParam(param);
    expect(p.ok && p.inquiry['project.site']).toBe('Ústí nad Labem – areál č. 3');
    expect(p.ok && p.input).toEqual(input);
  });
  it('poškozená nebo cizí data se odmítnou s důvodem', () => {
    expect(parseCase('{').ok).toBe(false);
    expect(parseCase('{"app":"jiná"}')).toEqual({ ok: false, reason: 'Soubor není případ této aplikace.' });
    expect(parseCase('{"app":"odparovac","schema":99}').ok).toBe(false);
    expect(caseFromParam('%%%').ok).toBe(false);
    const p = parseCase('{"app":"odparovac","schema":1,"input":{"fluid":"N2","T_out_C":null}}');
    expect(p.ok && p.input.T_out_C).toBe(-30); // chybějící / neplatné hodnoty → výchozí
  });
});

describe('poptávka – doplňky z nezávislé kontroly', () => {
  it('N₂ při −209 °C: TS min = teplota kapaliny (ne pevných −196 °C)', () => {
    const ev = evaluate({ ...defaultInput('N2'), liquid: { kind: 'subcooled', T_C: -205 } });
    const ts = buildInquiry(ev, chart).flatMap((i) => i.fields).find((f) => f.key === 'ped.ts')!;
    expect(ts.prefill).toContain('−205 °C');
  });
  it('24/7 → délka cyklu k doplnění, 2 × 100 % přepínané větve', () => {
    const ev = evaluate({ ...defaultInput('N2'), continuous24_7: true });
    const fields = buildInquiry(ev, chart).flatMap((i) => i.fields);
    expect(fields.find((f) => f.key === 'guar.cycle')!.source).toBe('DOPLNIT');
    expect(fields.find((f) => f.key === 'project.branches')!.prefill).toContain('2 × 100 % přepínané větve');
  });
  it('report: upozornění obsahují NEZADÁNO a výhradu HAZOP / SIL', () => {
    const { report } = models(defaultInput('O2'));
    const w = report.sections.find((s) => s.id === 'warnings')!.bullets!.join(' ');
    expect(w).toContain('K8 NEZADÁNO');
    expect(w).toContain('nenahrazují HAZOP / LOPA');
  });
});
