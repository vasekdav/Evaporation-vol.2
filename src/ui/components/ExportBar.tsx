import { useRef, useState } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import type { DesignInput } from '../../core/input';
import { makeCase, parseCase, shareUrl, type ParsedCase } from '../../report/caseFile';
import { downloadBlob, MIME, readFileText } from '../../report/download';
import { buildReport, reportFileName } from '../../report/model';

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
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const model = (kind: 'report' | 'inquiry') => buildReport(ev, { kind, basis, inquiry, appVersion });
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: `${label}: chyba – ${e instanceof Error ? e.message : String(e)}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  const pdf = (kind: 'report' | 'inquiry') =>
    run(kind === 'report' ? 'PDF report' : 'PDF poptávka', async () => {
      const { renderPdf } = await import('../../report/pdf');
      const m = model(kind);
      downloadBlob(new Uint8Array(await renderPdf(m)), reportFileName(m, 'pdf'), MIME.pdf);
      setMsg({ text: `Staženo: ${reportFileName(m, 'pdf')}` });
    });
  const xlsx = () =>
    run('Excel', async () => {
      const { renderXlsx } = await import('../../report/xlsx');
      const r = model('report');
      downloadBlob(await renderXlsx(r, model('inquiry')), reportFileName(r, 'xlsx'), MIME.xlsx);
      setMsg({ text: `Staženo: ${reportFileName(r, 'xlsx')}` });
    });
  const saveJson = () => {
    const c = makeCase(input, customBases, inquiry, appVersion);
    const name = `odparovac_pripad_${c.savedIso.slice(0, 10)}.json`;
    downloadBlob(JSON.stringify(c, null, 2), name, MIME.json);
    setMsg({ text: `Uloženo: ${name}` });
  };
  const loadJson = async (file: File) => {
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setMsg({ text: 'Načtení selhalo: soubor nelze přečíst.', error: true });
      return;
    }
    const p = parseCase(text);
    if (!p.ok) setMsg({ text: `Načtení selhalo: ${p.reason}`, error: true });
    else {
      onLoadCase(p);
      setMsg({ text: `Načten případ ze souboru ${file.name}.` });
    }
  };
  const copyLink = async () => {
    const url = shareUrl(makeCase(input, customBases, inquiry, appVersion), window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setLink(null);
      setMsg({ text: 'Odkaz na případ zkopírován do schránky.' });
    } catch {
      setLink(url);
      setMsg({ text: 'Schránka není dostupná – zkopíruj odkaz ručně z pole níže.' });
    }
  };

  return (
    <div className="export-bar" role="group" aria-label="Export a uložení">
      <div className="row">
        {variant === 'full' ? (
          <button type="button" className="btn" disabled={!!busy} onClick={() => pdf('report')}>
            {busy === 'PDF report' ? 'Připravuji…' : 'Report PDF'}
          </button>
        ) : null}
        <button type="button" className="btn" disabled={!!busy} onClick={() => pdf('inquiry')}>
          {busy === 'PDF poptávka' ? 'Připravuji…' : 'Poptávka PDF'}
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={xlsx}>
          {busy === 'Excel' ? 'Připravuji…' : 'Excel'}
        </button>
        {variant === 'full' ? (
          <>
            <button type="button" className="btn" onClick={saveJson}>
              Uložit případ
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Načíst případ
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              aria-label="Soubor případu"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadJson(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn" onClick={copyLink}>
              Kopírovat odkaz
            </button>
          </>
        ) : null}
      </div>
      {msg ? (
        <div className={`export-msg${msg.error ? ' err' : ''}`} role="status" data-narrative="">
          {msg.text}
        </div>
      ) : null}
      {link ? <input className="text-input" readOnly value={link} aria-label="Odkaz na případ" onFocus={(e) => e.target.select()} /> : null}
    </div>
  );
}
