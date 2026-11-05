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

describe('UX po nezávislé kontrole', () => {
  const input = (re: RegExp) => screen.getAllByLabelText(re).find((e) => e instanceof HTMLInputElement) as HTMLInputElement;
  it('chyba rozsahu se ukáže přímo u pole (tlak 100 barg → K2 u pole tlaku)', () => {
    render(<App />);
    fireEvent.change(input(/^Provozní tlak/), { target: { value: '100' } });
    const el = input(/^Provozní tlak/);
    expect(el.getAttribute('aria-invalid')).toBe('true');
    const field = el.closest('.field')!;
    expect(field.className).toContain('field-error');
    expect(field.textContent).toContain('K2');
  });
  it('nečitelné číslo → hláška u pole', () => {
    render(<App />);
    fireEvent.change(input(/^Špičkový návrhový průtok/), { target: { value: 'abc' } });
    expect(screen.getByText(/Zadej číslo, např. 1 000 nebo 1,5/)).toBeTruthy();
  });
  it('stavový pruh vypisuje důvody s odkazy na kontroly', () => {
    render(<App />);
    const reasons = screen.getByRole('list', { name: 'Důvody stavu' });
    const links = Array.from(reasons.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('#chk-K6'); // výchozí T_out = mez potrubí
    expect(links).toContain('#chk-D1');
    expect(document.getElementById('chk-K6')).toBeTruthy();
  });
  it('přepínač látky: šipky mění volbu, jen jedna zarážka tabulátoru', () => {
    render(<App />);
    const group = screen.getByRole('radiogroup', { name: 'Látka' });
    const radios = Array.from(group.querySelectorAll('button'));
    expect(radios.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /N₂/ }).getAttribute('aria-checked')).toBe('true');
  });
  it('navigace mezi stránkami přidává záznam do historie (gesto Zpět)', () => {
    render(<App />);
    const before = window.history.length;
    fireEvent.click(screen.getByRole('button', { name: 'Poptávka' }));
    expect(window.history.length).toBe(before + 1);
    expect(window.location.hash).toBe('#poptavka');
  });
  it('postup návrhu ukazuje stav kroků podle případu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Postup návrhu' }));
    expect(screen.getByTestId('step-state-3').textContent).toContain('chybí min. teplota lokality');
    expect(screen.getByTestId('step-state-2').textContent).toContain('viz POZOR');
  });
  it('znaménko minus je typografické (U+2212) ve výsledcích', () => {
    render(<App />);
    const q = document.querySelector('[data-results]')!.textContent!;
    expect(q).toContain('−161,66');
    expect(q).not.toMatch(/-\d/);
  });
});
