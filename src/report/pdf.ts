/**
 * PDF export (pdfmake, písmo Roboto s plnou českou diakritikou). Knihovna se načítá
 * až při exportu (dynamický import), aby nezatěžovala start aplikace.
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { SOURCE_SHORT, type ReportModel, type ReportSection, type RowSource } from './model';

const SRC_COLOR: Record<RowSource, string> = {
  VYPOCET: '#1f5fa8',
  PRAXE: '#1e7a3c',
  VYROBCE: '#7a3fa0',
  VSTUP: '#59636e',
  DOPLNIT: '#b42318',
  '': '#59636e',
};

/**
 * Písmo Roboto nemá znaky s kombinační tečkou nad (ṁ, V̇) – v PDF je nahradíme čitelnou
 * formou, jinak by se zobrazil prázdný rámeček.
 */
export function pdfText(t: string): string {
  return t.replace(/ṁ/g, 'm').replace(/\u0307/g, '');
}

const LEVEL_COLOR: Record<string, string> = {
  OK: '#1e7a3c',
  INFO: '#1f5fa8',
  NEZADÁNO: '#59636e',
  NEHODNOCENO: '#59636e',
  POZOR: '#9a6200',
  CHYBA: '#b42318',
};

function section(s: ReportSection): Content[] {
  // headlineLevel: nadpis se nesmí ocitnout sám na konci strany (viz pageBreakBefore)
  const out: Content[] = [{ text: pdfText(s.title), style: 'h2', headlineLevel: 1 } as Content];
  for (const p of s.paragraphs ?? []) out.push({ text: pdfText(p), style: 'p' });
  if (s.rows?.length) {
    out.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Veličina', style: 'th' },
            { text: 'Hodnota', style: 'th', alignment: 'right' },
            { text: 'Jednotka', style: 'th' },
            { text: 'Původ', style: 'th' },
          ],
          ...s.rows.map((r) => [
            { text: pdfText(r.label) },
            { text: pdfText(r.text), alignment: r.num !== undefined ? 'right' : 'left' },
            { text: pdfText(r.unit) },
            { text: SOURCE_SHORT[r.source], color: SRC_COLOR[r.source], fontSize: 7, bold: true },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      style: 'table',
    } as Content);
  }
  if (s.table) {
    const w = s.table.widths;
    out.push({
      table: {
        headerRows: 1,
        widths: w ? w.map((x) => `${(x / w.reduce((a, b) => a + b, 0)) * 100}%`) : s.table.head.map(() => '*'),
        body: [
          s.table.head.map((h) => ({ text: pdfText(h), style: 'th' })),
          ...s.table.body.map((r) =>
            r.map((c) => (LEVEL_COLOR[c] ? { text: c, color: LEVEL_COLOR[c], bold: true } : { text: pdfText(c) })),
          ),
        ],
      },
      layout: 'lightHorizontalLines',
      style: 'table',
    } as Content);
  }
  if (s.bullets?.length) out.push({ ul: s.bullets.map(pdfText), style: 'p' });
  return out;
}

/** Čistá funkce: model reportu → definice dokumentu pdfmake. */
export function buildPdfDefinition(m: ReportModel): TDocumentDefinitions {
  return {
    info: { title: m.title, creator: `Odpařovač ${m.appVersion}`, subject: m.subtitle },
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    pageBreakBefore: (node, q) => {
      if ((node as { headlineLevel?: number }).headlineLevel !== 1) return false;
      // pdfmake 0.3 předává dotazy jako objekt, starší verze pole uzlů
      const following = typeof q?.getFollowingNodesOnPage === 'function' ? q.getFollowingNodesOnPage() : (q as unknown as unknown[]);
      return Array.isArray(following) && following.length < 2;
    },
    defaultStyle: { font: 'Roboto', fontSize: 8.5, lineHeight: 1.15 },
    header: (page: number, count: number) => ({
      columns: [
        { text: m.title, fontSize: 7, color: '#59636e' },
        { text: `strana ${page} / ${count}`, alignment: 'right', fontSize: 7, color: '#59636e' },
      ],
      margin: [40, 20, 40, 0],
    }),
    footer: () => ({
      text: `Verze aplikace ${m.appVersion} · CoolProp ${m.coolpropVersion} · ${m.createdText} · ${m.disclaimer}`,
      fontSize: 6.5,
      color: '#59636e',
      margin: [40, 10, 40, 0],
    }),
    content: [
      { text: pdfText(m.title), style: 'h1' },
      { text: pdfText(m.subtitle), style: 'sub' },
      {
        table: {
          widths: ['*'],
          body: [[{ text: m.disclaimer, bold: true, fillColor: '#fff2d6', margin: [6, 4, 6, 4] }]],
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 6],
      },
      {
        columns: [
          { text: [{ text: 'Stav výsledku: ', bold: true }, m.status] },
          { text: [{ text: 'Datum: ', bold: true }, m.createdText], alignment: 'right' },
        ],
        margin: [0, 0, 0, 2],
      },
      { text: [{ text: 'Verze aplikace: ', bold: true }, `${m.appVersion} · vlastnosti látek CoolProp ${m.coolpropVersion}`], margin: [0, 0, 0, 8] },
      {
        text: 'Původ hodnot: VÝPOČET – fyzika · PRAXE – pravidlo nebo odhad z praxe · VÝROBCE – údaj výrobce (ilustrativní) · VSTUP – zadáno uživatelem · DOPLNIT – nutno doplnit',
        fontSize: 7,
        color: '#59636e',
        margin: [0, 0, 0, 6],
      },
      ...m.sections.flatMap(section),
    ],
    styles: {
      h1: { fontSize: 15, bold: true, margin: [0, 0, 0, 2] },
      sub: { fontSize: 9, color: '#59636e', margin: [0, 0, 0, 4] },
      h2: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
      th: { bold: true, color: '#59636e' },
      p: { margin: [0, 0, 0, 4] },
      table: { margin: [0, 0, 0, 4] },
    },
  };
}

type PdfMakeLike = {
  createPdf: (d: TDocumentDefinitions) => { getBuffer: () => Promise<Uint8Array> | Uint8Array };
  addVirtualFileSystem?: (vfs: unknown) => void;
  vfs?: unknown;
};

let loaded: Promise<PdfMakeLike> | null = null;

async function loadPdfMake(): Promise<PdfMakeLike> {
  loaded ??= (async () => {
    const [pm, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
    const pdfMake = ((pm as { default?: unknown }).default ?? pm) as PdfMakeLike;
    const vfs = (fonts as { default?: unknown }).default ?? fonts;
    if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(vfs);
    else pdfMake.vfs = vfs;
    return pdfMake;
  })();
  return loaded;
}

/** Vytvoří PDF jako bajty (funguje v prohlížeči i v Node pro testy). */
export async function renderPdf(m: ReportModel): Promise<Uint8Array> {
  const pdfMake = await loadPdfMake();
  return await pdfMake.createPdf(buildPdfDefinition(m)).getBuffer();
}
