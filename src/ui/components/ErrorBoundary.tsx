import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BASES_KEY, INQUIRY_KEY, STORAGE_KEY } from '../state';
import { tr } from '../../core/i18n';

interface State {
  error: Error | null;
}

/**
 * Pojistka proti bílé obrazovce: neočekávaná chyba v UI (např. poškozená uložená data)
 * zobrazí hlášku s možností smazat uložená data a začít znovu.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Chyba aplikace', error, info.componentStack);
  }

  private reset = (clear: boolean) => {
    if (clear) {
      try {
        for (const k of [STORAGE_KEY, BASES_KEY, INQUIRY_KEY]) window.localStorage.removeItem(k);
      } catch {
        /* úložiště nedostupné */
      }
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        /* bez historie */
      }
    }
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>{tr('Aplikace narazila na chybu', 'The application encountered an error')}</h1>
        <p>
          {tr(
            'Nejčastější příčinou jsou poškozená uložená data (poslední vstupy, vlastní katalogové základy nebo poptávka v tomto prohlížeči).',
            'The most common cause is corrupted saved data (last inputs, custom catalogue bases or the enquiry in this browser).',
          )}
        </p>
        <p className="muted">{this.state.error.message}</p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => this.reset(true)}>
            {tr('Smazat uložená data a začít znovu', 'Clear saved data and start again')}
          </button>
          <button type="button" className="btn" onClick={() => this.reset(false)}>
            {tr('Zkusit znovu', 'Try again')}
          </button>
        </div>
      </div>
    );
  }
}
