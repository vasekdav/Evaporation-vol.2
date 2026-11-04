import { useMemo } from 'react';
import { evaluate } from '../core/evaluate';
import { getProvider } from '../core/properties';
import { InputPanel } from './components/InputPanel';
import { Qty } from './components/Qty';
import { ChecksPanel, ResultCard, SourceLegend, StatusBanner } from './components/results';
import { StepByStep } from './components/StepByStep';
import { useDesignInput } from './state';
import { APP } from './texts';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export function App() {
  const [input, setInput, reset] = useDesignInput();
  // výsledky se přepočítávají okamžitě; evaluate je čistá funkce
  const ev = useMemo(() => evaluate(input), [input]);
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
          <InputPanel input={input} onChange={setInput} onReset={reset} />
        </aside>
        <main className="results" data-results="">
          <StatusBanner ev={ev} />
          <SourceLegend />
          <ResultCard ev={ev} />
          <ChecksPanel ev={ev} />
          <StepByStep ev={ev} />
        </main>
      </div>
      <footer className="app-footer" data-narrative="">
        Verze {APP_VERSION} · vlastnosti látek CoolProp {meta.coolprop_version} · {APP.disclaimer}
      </footer>
    </div>
  );
}
