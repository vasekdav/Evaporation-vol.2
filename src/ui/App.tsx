import { useEffect, useMemo, useState } from 'react';
import { findBasis } from '../core/catalog';
import { evaluate } from '../core/evaluate';
import { getProvider } from '../core/properties';
import { takeCaseFromUrl, type ParsedCase } from '../report/caseFile';
import { ConceptPanel } from './components/ConceptPanel';
import { ExportBar } from './components/ExportBar';
import { InputPanel } from './components/InputPanel';
import { Qty } from './components/Qty';
import { ChecksPanel, ResultCard, SectionNav, SourceLegend, StatusBanner, statusReasons } from './components/results';
import type { FieldIssue } from './components/fields';
import type { InputField } from '../core/checks';
import { SensitivityPanel } from './components/SensitivityPanel';
import { SizingPanel } from './components/SizingPanel';
import { StepByStep } from './components/StepByStep';
import { VerificationPage } from './components/VerificationPage';
import type { PageId } from './content/guide';
import { EquationsPage, GuidePage, SourcesPage } from './pages/InfoPages';
import { InquiryPage } from './pages/InquiryPage';
import { LearnPage } from './pages/LearnPage';
import { useCustomBases, useDesignInput, useInquiry, useLang, useTheme, type Theme } from './state';
import { Segmented } from './components/fields';
import { tr, type Lang } from '../core/i18n';
import { APP } from './texts';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const PAGES: readonly { id: PageId; label: () => string }[] = [
  { id: 'vypocet', label: () => tr('Výpočet a návrh', 'Calculation & design') },
  { id: 'postup', label: () => tr('Postup návrhu', 'Design procedure') },
  { id: 'poptavka', label: () => tr('Poptávka', 'Enquiry') },
  { id: 'proc-ne-kw', label: () => tr('Proč ne kW', 'Why not kW') },
  { id: 'rovnice', label: () => tr('Rovnice', 'Equations') },
  { id: 'overeni', label: () => tr('Ověření', 'Verification') },
  { id: 'zdroje', label: () => tr('Zdroje', 'Sources') },
];

const pageFromHash = (): PageId => {
  const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
  return (PAGES.find((p) => p.id === h)?.id ?? 'vypocet') as PageId;
};

interface AppProps {
  /** Případ ze sdíleného odkazu, přečtený před vykreslením (main.tsx). Bez něj se adresa přečte zde. */
  initialCase?: ParsedCase | null;
}

export function App({ initialCase }: AppProps = {}) {
  const [lang, setLang] = useLang();
  const [theme, setTheme] = useTheme();
  const [urlCase] = useState(() => (initialCase !== undefined ? initialCase : takeCaseFromUrl()));
  const okCase = urlCase?.ok ? urlCase : null;
  const [input, setInput, reset] = useDesignInput(okCase?.input);
  const [customBases, setCustomBases] = useCustomBases(okCase?.customBasis);
  const [inquiry, setInquiry] = useInquiry(okCase?.inquiry);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
    urlCase
      ? urlCase.ok
        ? { text: tr('Případ načten ze sdíleného odkazu.', 'Case loaded from the shared link.') }
        : { text: `${tr('Odkaz nelze načíst', 'The link cannot be loaded')}: ${urlCase.reason}`, error: true }
      : null,
  );
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  useEffect(() => {
    // Zpět / Vpřed v prohlížeči (gesto na tabletu) přepíná stránky aplikace
    const on = () => {
      const h = window.location.hash.replace('#', '');
      if (!h || PAGES.some((p) => p.id === h)) setPage(pageFromHash());
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  useEffect(() => {
    if (scrollTo === null) return;
    // po navigaci přesunout fokus na cíl (nadpis stránky nebo sekci), aby klávesnice i čtečka věděly, kde jsou
    const el = document.getElementById(scrollTo);
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus?.({ preventScroll: true });
    setScrollTo(null);
  }, [scrollTo, page]);

  const go = (p: PageId, anchor?: string) => {
    if (p !== page) {
      try {
        const url = p === 'vypocet' ? window.location.pathname + window.location.search : `#${p}`;
        window.history.pushState(null, '', url);
      } catch {
        /* bez historie (např. file://) – nevadí */
      }
    }
    setPage(p);
    setScrollTo(anchor ?? 'page-top');
    if (!anchor) document.documentElement.scrollTop = 0;
  };

  // výsledky se přepočítávají okamžitě; evaluate je čistá funkce
  // eslint-disable-next-line react-hooks/exhaustive-deps -- jazyk mění texty výsledku
  const ev = useMemo(() => evaluate(input, { extraBases: customBases }), [input, customBases, lang]);
  const basis = findBasis(input.catalogBasisId, customBases);
  const meta = getProvider(input.fluid).meta;

  const loadCase = (c: Extract<ParsedCase, { ok: true }>) => {
    setInput(c.input);
    if (c.customBasis) setCustomBases([...customBases.filter((b) => b.id !== c.customBasis!.id), c.customBasis]);
    setInquiry(c.inquiry);
  };
  const exportProps = { ev, input, basis, customBases, inquiry, appVersion: APP_VERSION, onLoadCase: loadCase };
  // nálezy kontrol přiřazené k polím vstupů (chyba se ukáže přímo u pole)
  const issues = useMemo(() => {
    const out: Partial<Record<InputField, FieldIssue[]>> = {};
    for (const c of ev.checks) {
      if ((c.level !== 'CHYBA' && c.level !== 'POZOR') || !c.fields) continue;
      const lvl = c.level;
      const text = c.id === 'K1' ? tr('Neplatná nebo chybějící hodnota (K1).', 'Invalid or missing value (K1).') : `${c.id}: ${c.message}`;
      for (const f of c.fields) (out[f] ??= []).push({ level: lvl, text });
    }
    return out;
  }, [ev.checks, lang]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{APP.title}</h1>
          <p className="subtitle">{APP.subtitle}</p>
        </div>
        <p className="disclaimer" role="note">
          {APP.disclaimer}
        </p>
        <div className="prefs">
          <Segmented<Lang>
            ariaLabel={tr('Jazyk', 'Language')}
            value={lang}
            options={[
              { value: 'cs', label: 'CZ' },
              { value: 'en', label: 'EN' },
            ]}
            onChange={setLang}
          />
          <Segmented<Theme>
            ariaLabel={tr('Barevný režim', 'Colour mode')}
            value={theme}
            options={[
              { value: 'light', label: tr('☀ Světlý', '☀ Light') },
              { value: 'dark', label: tr('☾ Tmavý', '☾ Dark') },
            ]}
            onChange={setTheme}
          />
        </div>
      </header>
      <nav className="tabs" aria-label={tr('Stránky', 'Pages')}>
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={page === p.id ? 'on' : ''}
            aria-current={page === p.id ? 'page' : undefined}
            onClick={() => go(p.id)}
          >
            {p.label()}
          </button>
        ))}
      </nav>
      {notice ? (
        <div className={`notice${notice.error ? ' err' : ''}`} role="status">
          {notice.text}{' '}
          <button type="button" className="link-btn" onClick={() => setNotice(null)}>
            {tr('zavřít', 'close')}
          </button>
        </div>
      ) : null}

      {page === 'vypocet' ? (
        <>
          {/* úzká obrazovka (tablet na výšku): výsledek stále na očích, i když jsou vstupy nahoře */}
          <div className={`summary-bar ${ev.duty ? '' : 'summary-invalid'}`} role="region" aria-label={tr('Souhrn výsledku', 'Result summary')}>
            <span className="summary-status">{ev.statusText}</span>
            {statusReasons(ev).length ? (
              <span className="summary-reasons" data-narrative="">
                {statusReasons(ev).map((c) => (
                  <a key={c.id} href={`#chk-${c.id}`}>
                    {c.id}
                  </a>
                ))}
              </span>
            ) : null}
            {ev.duty ? (
              <span>
                Q = <Qty v={ev.duty.Q_kW} unit="kW" src="VYPOCET" />
              </span>
            ) : null}
            <a href="#res-h">{tr('výsledky ↓', 'results ↓')}</a>
          </div>
          <div className="layout">
            <aside className="inputs">
              <InputPanel
                input={input}
                onChange={setInput}
                onReset={reset}
                customBases={customBases}
                onCustomBasesChange={setCustomBases}
                issues={issues}
              />
            </aside>
            <main className="results" data-results="">
              <h2 id="page-top" className="sr-only" tabIndex={-1}>
                {tr('Výsledky výpočtu', 'Calculation results')}
              </h2>
              <StatusBanner ev={ev} />
              <SectionNav />
              <ExportBar {...exportProps} />
              <SourceLegend />
              <ResultCard ev={ev} />
              <ChecksPanel ev={ev} />
              <SizingPanel ev={ev} basis={basis} />
              <ConceptPanel ev={ev} />
              <SensitivityPanel ev={ev} basis={basis} />
              <StepByStep ev={ev} />
            </main>
          </div>
        </>
      ) : (
        <div className="page" id="page-top" tabIndex={-1}>
          {page === 'poptavka' ? (
            <InquiryPage
              ev={ev}
              basis={basis}
              overrides={inquiry}
              onChange={setInquiry}
              toolbar={<ExportBar {...exportProps} variant="inquiry" />}
            />
          ) : null}
          {page === 'postup' ? <GuidePage fluid={input.fluid} go={go} ev={ev} inquiry={inquiry} basis={basis} /> : null}
          {page === 'proc-ne-kw' ? <LearnPage ev={ev} basis={basis} /> : null}
          {page === 'rovnice' ? <EquationsPage /> : null}
          {page === 'overeni' ? <VerificationPage key={lang} /> : null}
          {page === 'zdroje' ? <SourcesPage /> : null}
        </div>
      )}
      <footer className="app-footer" data-narrative="">
        {tr('Verze', 'Version')} {APP_VERSION} · {tr('vlastnosti látek', 'fluid properties')} CoolProp {meta.coolprop_version} · {APP.disclaimer}
      </footer>
    </div>
  );
}
