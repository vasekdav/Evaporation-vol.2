import { useRef, useState } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import type { DesignInput } from '../../core/input';
import { makeCase, parseCase, shareUrl, type ParsedCase } from '../../report/caseFile';
import { downloadBlob, MIME, readFileText } from '../../report/download';
import { buildReport, reportFileName } from '../../report/model';
import { tr } from '../../core/i18n';

type Job = 'pdf-report' | 'pdf-inquiry' | 'excel';
const jobLabel = (j: Job) => (j === 'pdf-report' ? tr('PDF report', 'PDF report') : j === 'pdf-inquiry' ? tr('PDF poptávka', 'PDF enquiry') : 'Excel');

interface Props {
  ev: Evaluation;
  input: DesignInput;
  basis: CatalogBasis | undefined;
  customBases: readonly CatalogBasis[];
  inquiry: Record<string, string>;
  appVersion: string;
  onLoadCase: (c: Extract<ParsedCase, { ok: true }>) => void;
  /** které akce ukázat */
  variant?: 'full' | 'inquiry';
}

/** Export: PDF report, PDF poptávka, Excel, uložení / načtení případu (JSON), sdílitelný odkaz. */
export function ExportBar({ ev, input, basis, customBases, inquiry, appVersion, onLoadCase, variant = 'full' }: Props) {
  const [busy, setBusy] = useState<Job | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const model = (kind: 'report' | 'inquiry') => buildReport(ev, { kind, basis, inquiry, appVersion });
  const run = async (job: Job, fn: () => Promise<void>) => {
    setBusy(job);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: `${jobLabel(job)}: ${tr('chyba', 'error')} – ${e instanceof Error ? e.message : String(e)}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  const pdf = (kind: 'report' | 'inquiry') =>
    run(kind === 'report' ? 'pdf-report' : 'pdf-inquiry', async () => {
      const { renderPdf } = await import('../../report/pdf');
      const m = model(kind);
      downloadBlob(new Uint8Array(await renderPdf(m)), reportFileName(m, 'pdf'), MIME.pdf);
      setMsg({ text: `${tr('Staženo', 'Downloaded')}: ${reportFileName(m, 'pdf')}` });
    });
  const xlsx = () =>
    run('excel', async () => {
      const { renderXlsx } = await import('../../report/xlsx');
      const r = model('report');
      downloadBlob(await renderXlsx(r, model('inquiry')), reportFileName(r, 'xlsx'), MIME.xlsx);
      setMsg({ text: `${tr('Staženo', 'Downloaded')}: ${reportFileName(r, 'xlsx')}` });
    });
  const saveJson = () => {
    const c = makeCase(input, customBases, inquiry, appVersion);
    const name = `${tr('odparovac_pripad', 'vaporizer_case')}_${c.savedIso.slice(0, 10)}.json`;
    downloadBlob(JSON.stringify(c, null, 2), name, MIME.json);
    setMsg({ text: `${tr('Uloženo', 'Saved')}: ${name}` });
  };
  const loadJson = async (file: File) => {
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setMsg({ text: tr('Načtení selhalo: soubor nelze přečíst.', 'Loading failed: the file cannot be read.'), error: true });
      return;
    }
    const p = parseCase(text);
    if (!p.ok) setMsg({ text: `${tr('Načtení selhalo', 'Loading failed')}: ${p.reason}`, error: true });
    else {
      onLoadCase(p);
      setMsg({ text: tr(`Načten případ ze souboru ${file.name}.`, `Case loaded from file ${file.name}.`) });
    }
  };
  const copyLink = async () => {
    const url = shareUrl(makeCase(input, customBases, inquiry, appVersion), window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setLink(null);
      setMsg({ text: tr('Odkaz na případ zkopírován do schránky.', 'Case link copied to the clipboard.') });
    } catch {
      setLink(url);
      setMsg({ text: tr('Schránka není dostupná – zkopíruj odkaz ručně z pole níže.', 'Clipboard not available – copy the link manually from the field below.') });
    }
  };

  return (
    <div className="export-bar" role="group" aria-label={tr('Export a uložení', 'Export and save')}>
      <div className="row">
        {variant === 'full' ? (
          <button type="button" className="btn" disabled={!!busy} onClick={() => pdf('report')}>
            {busy === 'pdf-report' ? tr('Připravuji…', 'Preparing…') : tr('Report PDF', 'PDF report')}
          </button>
        ) : null}
        <button type="button" className="btn" disabled={!!busy} onClick={() => pdf('inquiry')}>
          {busy === 'pdf-inquiry' ? tr('Připravuji…', 'Preparing…') : tr('Poptávka PDF', 'PDF enquiry')}
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={xlsx}>
          {busy === 'excel' ? tr('Připravuji…', 'Preparing…') : 'Excel'}
        </button>
        {variant === 'full' ? (
          <>
            <button type="button" className="btn" onClick={saveJson}>
              {tr('Uložit případ', 'Save case')}
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              {tr('Načíst případ', 'Load case')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label={tr('Soubor případu', 'Case file')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadJson(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn" onClick={copyLink}>
              {tr('Kopírovat odkaz', 'Copy link')}
            </button>
          </>
        ) : null}
      </div>
      {msg ? (
        <div className={`export-msg${msg.error ? ' err' : ''}`} role="status" data-narrative="">
          {msg.text}
        </div>
      ) : null}
      {link ? <input className="text-input" readOnly value={link} aria-label={tr('Odkaz na případ', 'Case link')} onFocus={(e) => e.target.select()} /> : null}
    </div>
  );
}
