// @vitest-environment jsdom
/** UI regresní testy k nálezům nezávislé kontroly SW: žádná bílá obrazovka. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/ui/App';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary';
import { BASES_KEY, INQUIRY_KEY, STORAGE_KEY } from '../src/ui/state';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const POISON: unknown[] = [
  { fluid: 'O2', flow: {} },
  { fluid: 'O2', flow: { value: 1, unit: '__proto__' } },
  { fluid: 'O2', liquid: { kind: 'subcooled' } },
  { fluid: 'O2', pressure: { kind: 'gauge' } },
  { fluid: 'O2', catalogBasisId: 7 },
  { fluid: 'O2', T_out_C: 'x', p_atm_bar_a: {}, k: [] },
  { fluid: 'O2', avgFlow: { value: 'x' } },
];

describe('poškozená uložená data nesmí shodit aplikaci', () => {
  it.each(POISON.map((p) => [JSON.stringify(p), p]))('localStorage %s', (_s, p) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    window.localStorage.setItem(BASES_KEY, '[{"id":"own-1","name":"x","T_amb_C":"a"}]');
    window.localStorage.setItem(INQUIRY_KEY, '{"a":{}}');
    render(<App />);
    expect(screen.getByTestId('Q')).toBeTruthy();
  });
  it('soubor případu s vnořeným poškozením → aplikace běží dál', async () => {
    render(<App />);
    const file = new File(['{"app":"odparovac","schema":1,"input":{"fluid":"N2","flow":{}}}'], 'x.json');
    fireEvent.change(screen.getByLabelText('Soubor případu'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Načten případ ze souboru x.json/)).toBeTruthy());
    expect(screen.getByTestId('Q')).toBeTruthy();
  });
  it('ErrorBoundary: chyba v UI → hláška a obnovení smazáním uložených dat', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let boom = true;
    function Bomb() {
      if (boom) throw new Error('rozbito');
      return <p>v pořádku</p>;
    }
    window.localStorage.setItem(STORAGE_KEY, 'x');
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Aplikace narazila na chybu');
    boom = false;
    fireEvent.click(screen.getByRole('button', { name: 'Smazat uložená data a začít znovu' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText('v pořádku')).toBeTruthy();
  });
  it('starší odkaz ?case= stále funguje a zmizí z adresy', async () => {
    const { makeCase, caseToParam } = await import('../src/report/caseFile');
    const { defaultInput } = await import('../src/core');
    const c = makeCase({ ...defaultInput('N2') }, [], {}, 't');
    window.history.replaceState(null, '', `/?case=${caseToParam(c)}`);
    render(<App />);
    expect(screen.getByText('Případ načten ze sdíleného odkazu.')).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});
