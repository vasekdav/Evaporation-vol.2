import { useEffect, useMemo, useState } from 'react';
import { findBasis } from '../core/catalog';
import { evaluate } from '../core/evaluate';
import { getProvider } from '../core/properties';
import { ConceptPanel } from './components/ConceptPanel';
import { InputPanel } from './components/InputPanel';
import { Qty } from './components/Qty';
import { ChecksPanel, ResultCard, SourceLegend, StatusBanner } from './components/results';
import { SensitivityPanel } from './components/SensitivityPanel';
import { SizingPanel } from './components/SizingPanel';
import { StepByStep } from './components/StepByStep';
import { VerificationPage } from './components/VerificationPage';
import { useCustomBases, useDesignInput } from './state';
import { APP } from './texts';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

type Page = 'vypocet' | 'overeni';
const PAGES: readonly { id: Page; label: string }[] = [
  { id: 'vypocet', label: 'Výpočet a návrh' },
  { id: 'overeni', label: 'Ověření' },
];

const pageFromHash = (): Page => (typeof window !== 'undefined' && window.location.hash === '#overeni' ? 'overeni' : 'vypocet');

export function App() {
  const [input, setInput, reset] = useDesignInput();
  const [customBases, setCustomBases] = useCustomBases();
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (p: Page) => {
    setPage(p);
    try {
      window.history.replaceState(null, '', p === 'overeni' ? '#overeni' : '#');
    } catch {
      /* bez historie (např. file://) – nevadí */
    }
  };

  // výsledky se přepočítávají okamžitě; evaluate je čistá funkce
  const ev = useMemo(() => evaluate(input, { extraBases: customBases }), [input, customBases]);
  const basis = findBasis(input.catalogBasisId, customBases);
  const meta = getProvider(input.fluid).meta;

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
      </header>
      <nav className="tabs" aria-label="Stránky">
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={page === p.id ? 'on' : ''}
            aria-current={page === p.id ? 'page' : undefined}
            onClick={() => go(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      {page === 'overeni' ? (
        <div className="page">
          <VerificationPage />
        </div>
      ) : (
        <>
          {/* úzká obrazovka (tablet na výšku): výsledek stále na očích, i když jsou vstupy nahoře */}
          <div className={`summary-bar ${ev.duty ? '' : 'summary-invalid'}`} role="region" aria-label="Souhrn výsledku">
            <span className="summary-status">{ev.statusText}</span>
            {ev.duty ? (
              <span>
                Q = <Qty v={ev.duty.Q_kW} unit="kW" src="VYPOCET" />
              </span>
            ) : null}
            <a href="#res-h">výsledky ↓</a>
          </div>
          <div className="layout">
            <aside className="inputs">
              <InputPanel
                input={input}
                onChange={setInput}
                onReset={reset}
                customBases={customBases}
                onCustomBasesChange={setCustomBases}
              />
            </aside>
            <main className="results" data-results="">
              <StatusBanner ev={ev} />
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
      )}
      <footer className="app-footer" data-narrative="">
        Verze {APP_VERSION} · vlastnosti látek CoolProp {meta.coolprop_version} · {APP.disclaimer}
      </footer>
    </div>
  );
}
