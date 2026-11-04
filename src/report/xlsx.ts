/**
 * Excel export (ExcelJS): listy Info, Vstupy, Výsledky, Kontroly, Poptávka.
 * Čísla se ukládají jako čísla (ne text), s formátem podle počtu desetinných míst.
 * Knihovna se načítá až při exportu.
 */
import type { Workbook, Worksheet } from 'exceljs';
import { SOURCE_SHORT, type ReportModel, type ReportSection } from './model';

const numFmt = (d: number | undefined) => (d === undefined || d <= 0 ? '0' : `0.${'0'.repeat(d)}`);

function rowsSheet(ws: Worksheet, sections: readonly ReportSection[]) {
  ws.columns = [
    { header: 'Oddíl', key: 'sec', width: 30 },
    { header: 'Veličina', key: 'label', width: 52 },
    { header: 'Hodnota', key: 'value', width: 18 },
    { header: 'Jednotka', key: 'unit', width: 22 },
    { header: 'Původ', key: 'src', width: 11 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const s of sections) {
    for (const r of s.rows ?? []) {
      const row = ws.addRow({ sec: s.title, label: r.label, value: r.num ?? r.text, unit: r.unit, src: SOURCE_SHORT[r.source] });
      if (r.num !== undefined) row.getCell('value').numFmt = numFmt(r.decimals);
    }
    for (const t of [...(s.paragraphs ?? []), ...(s.bullets ?? [])]) ws.addRow({ sec: s.title, label: t });
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function tableSheet(ws: Worksheet, s: ReportSection | undefined) {
  if (!s?.table) return;
  ws.addRow(s.table.head).font = { bold: true };
  for (const r of s.table.body) ws.addRow(r);
  ws.columns.forEach((c, i) => (c.width = i === 2 ? 80 : 22));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Sestaví sešit ze dvou modelů: report (vstupy + výsledky + kontroly) a poptávka. */
export function fillWorkbook(wb: Workbook, report: ReportModel, inquiry: ReportModel): Workbook {
  wb.creator = `Odpařovač ${report.appVersion}`;
  wb.created = new Date(report.createdIso);
  const info = wb.addWorksheet('Info');
  info.columns = [{ width: 28 }, { width: 100 }];
  for (const [k, v] of [
    ['Název', report.title],
    ['Verze aplikace', report.appVersion],
    ['Vlastnosti látek', `CoolProp ${report.coolpropVersion}`],
    ['Datum', report.createdText],
    ['Stav výsledku', report.status],
    ['Upozornění', report.disclaimer],
  ])
    info.addRow([k, v]);
  info.getColumn(1).font = { bold: true };

  const by = (id: string) => report.sections.find((s) => s.id === id);
  rowsSheet(wb.addWorksheet('Vstupy'), [by('inputs')].filter(Boolean) as ReportSection[]);
  rowsSheet(
    wb.addWorksheet('Výsledky'),
    ['results', 'steps', 'sizing', 'warnings'].map(by).filter(Boolean) as ReportSection[],
  );
  tableSheet(wb.addWorksheet('Kontroly'), by('checks'));
  if (by('concept')) tableSheet(wb.addWorksheet('Koncept'), by('concept'));
  rowsSheet(wb.addWorksheet('Poptávka'), inquiry.sections);
  return wb;
}

export async function renderXlsx(report: ReportModel, inquiry: ReportModel): Promise<ArrayBuffer> {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as { default?: unknown }).default ?? mod) as typeof import('exceljs');
  const wb = fillWorkbook(new ExcelJS.Workbook(), report, inquiry);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
