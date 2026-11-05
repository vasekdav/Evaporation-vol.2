// @vitest-environment jsdom
/** UI testy fáze 4: poptávka, export, uložení / načtení případu, odkaz, výuková a informační stránky. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileText } from '../src/report/download';
import { App } from '../src/ui/App';
import { untaggedNumbers } from './uiHelpers';

const blobs: Blob[] = [];
beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  blobs.length = 0;
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return 'blob:test';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tab = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const qText = () => screen.getByTestId('Q').querySelector('.num')!.textContent;
const byLabel = (re: RegExp) => screen.getAllByLabelText(re).find((e) => e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) as HTMLInputElement;

describe('navigace', () => {
  it('sedm stránek', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Stránky' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Výpočet a návrh',
      'Poptávka',
      'Postup návrhu',
      'Proč ne kW',
      'Rovnice',
      'Ověření',
      'Zdroje',
    ]);
  });
});

describe('poptávka', () => {
  it('předvyplněno ze vstupů; přepsání svázaného pole → nesoulad; návrat k hodnotě ze vstupů', () => {
    render(<App />);
    tab('Poptávka');
    expect(screen.getByTestId('inquiry-check').textContent).toBe('Svázaná pole poptávky odpovídají vstupům výpočtu');
    const peak = byLabel(/^Garantovaný průtok/);
    expect(peak.value).toBe('1 000 Nm³/h (špička)');
    fireEvent.change(peak, { target: { value: '800 Nm³/h' } });
    expect(screen.getByTestId('inquiry-check').textContent).toBe('Poptávka se liší od vstupů výpočtu v 1 poli');
    fireEvent.click(screen.getByRole('button', { name: 'použít hodnotu ze vstupů' }));
    expect(screen.getByTestId('inquiry-check').textContent).toBe('Svázaná pole poptávky odpovídají vstupům výpočtu');
    expect(screen.getByText('Kyslíková čistota')).toBeTruthy();
    expect(screen.getAllByText('Proč to výrobce potřebuje').length).toBe(11);
  });
  it('změna látky se promítne do poptávky (N₂ → běžná čistota)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    tab('Poptávka');
    expect(byLabel(/^Požadavek/).value).toBe('běžná čistota pro kryogenní službu');
    expect(byLabel(/^Médium/).value).toContain('LIN');
  });
  it('úpravy poptávky se pamatují', () => {
    render(<App />);
    tab('Poptávka');
    fireEvent.change(byLabel(/^Lokalita/), { target: { value: 'Kladno' } });
    cleanup();
    render(<App />);
    tab('Poptávka');
    expect(byLabel(/^Lokalita/).value).toBe('Kladno');
  });
});

describe('uložení a načtení případu', () => {
  it('Uložit případ → JSON; Načíst případ → stejná čísla', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    fireEvent.change(byLabel(/^Návrhová výstupní teplota/), { target: { value: '-20' } });
    const q = qText();
    fireEvent.click(screen.getByRole('button', { name: 'Uložit případ' }));
    expect(blobs).toHaveLength(1);
    const json = await readFileText(blobs[0]!);
    expect(JSON.parse(json).input.fluid).toBe('N2');
    // jiný stav a pak načtení
    fireEvent.click(screen.getByRole('button', { name: 'Výchozí hodnoty' }));
    fireEvent.click(screen.getByRole('radio', { name: /O₂/ }));
    expect(qText()).not.toBe(q);
    const file = new File([json], 'pripad.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Soubor případu'), { target: { files: [file] } });
    await waitFor(() => expect(qText()).toBe(q));
    expect(screen.getByText(/Načten případ ze souboru pripad.json/)).toBeTruthy();
  });
  it('neplatný soubor → chybová hláška, stav beze změny', async () => {
    render(<App />);
    const file = new File(['{"app":"x"}'], 'x.json');
    fireEvent.change(screen.getByLabelText('Soubor případu'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Načtení selhalo: Soubor není případ této aplikace/)).toBeTruthy());
    expect(qText()).toBe('139,71');
  });
  it('sdílitelný odkaz: zkopírovat, otevřít → stejný případ; parametr zmizí z URL', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async (t: string) => void (copied = t)) },
      configurable: true,
    });
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    fireEvent.change(byLabel(/^Teplota okolí pro výpočet/), { target: { value: '-15' } });
    const neq = screen.getByTestId('Neq').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat odkaz' }));
    await waitFor(() => expect(copied).toContain('#case='));
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, '', new URL(copied).pathname + new URL(copied).hash);
    render(<App />);
    expect(screen.getByText('Případ načten ze sdíleného odkazu.')).toBeTruthy();
    expect(screen.getByTestId('Neq').textContent).toBe(neq);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });
  it('poškozený odkaz → hláška, výchozí případ', () => {
    window.history.replaceState(null, '', '/?case=nesmysl');
    render(<App />);
    expect(screen.getByText(/Odkaz nelze načíst/)).toBeTruthy();
    expect(qText()).toBe('139,71');
  });
});

describe('export PDF a Excel z UI', () => {
  it('Report PDF a Excel se stáhnou', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Report PDF' }));
    await waitFor(() => expect(screen.getByText(/Staženo: odparovac_.*\.pdf/)).toBeTruthy(), { timeout: 20000 });
    expect(blobs.at(-1)!.type).toBe('application/pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(screen.getByText(/Staženo: odparovac_.*\.xlsx/)).toBeTruthy(), { timeout: 20000 });
    expect(blobs.at(-1)!.size).toBeGreaterThan(5000);
  }, 40000);
});

describe('výuka a informační stránky', () => {
  it('Proč ne kW: tři barevné sloupce; posun teploty vzduchu nemění Q, mění N_eq', () => {
    render(<App />);
    tab('Proč ne kW');
    expect(screen.getByRole('heading', { name: 'Výpočet' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Praxe' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Realita' })).toBeTruthy();
    const Q0 = screen.getByTestId('learn-Q').textContent;
    const N0 = screen.getByTestId('learn-Neq').textContent;
    fireEvent.change(screen.getByLabelText(/Teplota vzduchu/), { target: { value: '-15' } });
    expect(screen.getByTestId('learn-Q').textContent).toBe(Q0);
    expect(screen.getByTestId('learn-Neq').textContent).not.toBe(N0);
    fireEvent.change(screen.getByLabelText(/Výstupní teplota plynu/), { target: { value: '-10' } });
    expect(screen.getByTestId('learn-Neq').textContent).toContain('nelze');
    expect(untaggedNumbers(screen.getByTestId('learn-Q'))).toEqual([]);
  });
  it('Postup návrhu: 11 kroků (1–10 + 5b), krok 8 podle látky', () => {
    render(<App />);
    tab('Postup návrhu');
    expect(document.querySelectorAll('.guide-step')).toHaveLength(11);
    expect(screen.getByText(/Kyslíková čistota: čištění a materiály/)).toBeTruthy();
    expect(screen.getAllByText('Typická chyba')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: '→ Generátor poptávky' }));
    expect(screen.getByTestId('inquiry-check')).toBeTruthy();
  });
  it('Postup návrhu pro N₂: riziko udušení', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    tab('Postup návrhu');
    expect(screen.getByText(/Riziko udušení/)).toBeTruthy();
  });
  it('Rovnice a Zdroje', () => {
    render(<App />);
    tab('Rovnice');
    expect(screen.getByText(/UA_potř = Q_I\/ΔT_I \+ Q_II\/LMTD_II/)).toBeTruthy();
    tab('Zdroje');
    expect(screen.getByText(/AIGA 027\/15/)).toBeTruthy();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(5);
  });
});
