// @vitest-environment jsdom
/** UI testy fáze 3: velikost, koncept, citlivost, katalogové základy, stránka Ověření. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultInput, evaluate, fmt, runVerification } from '../src/core';
import { App } from '../src/ui/App';
import { restoreBases } from '../src/ui/state';
import { untaggedNumbers } from './uiHelpers';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});
afterEach(cleanup);

const results = () => document.querySelector('[data-results]') as HTMLElement;
const input = (label: RegExp): HTMLInputElement => {
  const el = screen.getAllByLabelText(label).find((e) => e instanceof HTMLInputElement);
  if (!el) throw new Error(`pole ${label} nenalezeno`);
  return el as HTMLInputElement;
};
const type = (el: HTMLInputElement, value: string) => fireEvent.change(el, { target: { value } });
const neq = () => screen.getByTestId('Neq').querySelector('.num')!.textContent;
const minCap = () => screen.getByTestId('minCap').querySelector('.num')!.textContent;

describe('posouzení velikosti v UI', () => {
  it('O₂ výchozí: N_eq 786,5 Nm³/h (kap. 9), nejmenší kapacita = V̇n = 1 000 Nm³/h', () => {
    render(<App />);
    expect(neq()).toBe('786,5');
    expect(minCap()).toBe(fmt(1000, 0));
    expect(screen.getByText(/dolní hranice pro poptávku – NE doporučený model/)).toBeTruthy();
    expect(screen.getByText(/IDEÁLNÍ DOLNÍ MEZ/)).toBeTruthy();
    expect(within(results()).getByText(/výsledek je proto OPTIMISTICKÝ/)).toBeTruthy();
  });
  it('O₂ −15 °C / −20 °C: N_eq 1 247,8; s k = 1,3 nejmenší kapacita = N_eq·k', () => {
    render(<App />);
    type(input(/Teplota okolí pro výpočet/), '-15');
    type(input(/Návrhová výstupní teplota/), '-20');
    expect(neq()).toBe(fmt(1247.8, 1));
    type(input(/Koeficient námrazy/), '1,3');
    const ev = evaluate({ ...defaultInput('O2'), T_amb_C: -15, T_out_C: -20, k: 1.3 });
    expect(ev.sizing?.ok).toBe(true);
    if (ev.sizing?.ok) expect(minCap()).toBe(fmt(ev.sizing.minBranchCapacity_Nm3_h, 0));
  });
  it('N₂: N_eq 755,6 a ilustrace ze sloupce LIN (první model SG360HF), O₂ ze sloupce LOX (SG430HF)', () => {
    render(<App />);
    expect(screen.getByText('Ilustrace z katalogu – výběr a garance výrobce')).toBeTruthy();
    expect(screen.getByText(/Kapacita LOX/)).toBeTruthy();
    const ill = () => results().querySelector('.illustration') as HTMLElement;
    expect(within(ill()).getAllByText('SG430HF')[0]).toBeTruthy();
    expect(within(ill()).queryByText('SG360HF')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    expect(neq()).toBe('755,6');
    expect(screen.getByText(/Kapacita LIN/)).toBeTruthy();
    expect(within(ill()).getByText('SG360HF')).toBeTruthy();
  });
  it('T_min −35 °C a T_out −30 °C → posouzení velikosti „nelze“', () => {
    render(<App />);
    type(input(/Minimální návrhová teplota okolí lokality/), '-35');
    expect(screen.queryByTestId('Neq')).toBeNull();
    expect(within(results()).getAllByText(/Posouzení velikosti nelze/).length).toBeGreaterThan(0);
  });
  it('neověřený katalogový tlak Chart je vidět u posouzení', () => {
    render(<App />);
    expect(within(results()).getByText(/není ověřen v podkladu výrobce/)).toBeTruthy();
  });
});

describe('koncept v UI', () => {
  it('výchozí 8 h/den → jedna větev doporučeno; 24/7 → dvě přepínané větve', () => {
    render(<App />);
    const first = () => document.querySelector('[data-concept]')!;
    expect(first().getAttribute('data-concept')).toBe('SINGLE');
    expect(first().getAttribute('data-role')).toBe('doporučeno');
    fireEvent.click(screen.getByRole('checkbox', { name: '24/7' }));
    expect(first().getAttribute('data-concept')).toBe('SWITCHED');
  });
  it('přiblížení < 10 K a malá rezerva nad TSL → tři varianty (a)/(b)/(c)', () => {
    render(<App />);
    expect(screen.queryByTestId('variants')).toBeNull();
    type(input(/Teplota okolí pro výpočet/), '-15');
    type(input(/Návrhová výstupní teplota/), '-20');
    type(input(/Nastavení TSL/), '-22');
    const v = screen.getByTestId('variants');
    expect(v.textContent).toContain('větší odpařovač');
    expect(v.textContent).toContain('nižší T_out + dohřev');
    expect(v.textContent).toContain('nerezu');
    expect(v.textContent).toContain('analýzy rizik');
  });
});

describe('citlivost v UI', () => {
  it('pět grafů s tabulkovým zobrazením; graf jde procházet klávesnicí', () => {
    render(<App />);
    const charts = within(results()).getAllByRole('img');
    expect(charts.length).toBe(5);
    expect(within(results()).getAllByText(/^Tabulka:/).length).toBe(3);
    fireEvent.keyDown(charts[0]!, { key: 'ArrowRight' });
    expect(results().querySelector('.tooltip')!.textContent).toMatch(/kW/);
  });
});

describe('žádné číslo bez jednotky a původu (fáze 3)', () => {
  it.each([
    ['výchozí', () => {}],
    ['malé přiblížení, TSL, 24/7, N+1', () => {
      type(input(/Teplota okolí pro výpočet/), '-15');
      type(input(/Návrhová výstupní teplota/), '-20');
      type(input(/Nastavení TSL/), '-22');
      fireEvent.click(screen.getByRole('checkbox', { name: '24/7' }));
      fireEvent.click(screen.getByRole('radio', { name: 'N+1' }));
    }],
    ['stránka Ověření', () => fireEvent.click(screen.getByRole('button', { name: 'Ověření' }))],
  ])('%s', (_n, act) => {
    render(<App />);
    act();
    const bad = untaggedNumbers(results());
    if (bad.length) console.info(bad);
    expect(bad).toEqual([]);
  });
});

describe('katalogové základy – editovatelné, vlastní', () => {
  it('kopie Chart s tlakem 15 bar a: N_eq vzroste asi o 0,1 %, základ se uloží a jde smazat', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit jako vlastní kopii' }));
    const editor = screen.getByRole('group', { name: 'Úprava katalogového základu' });
    fireEvent.click(within(editor).getByRole('radio', { name: 'absolutní' }));
    fireEvent.click(within(editor).getByRole('checkbox', { name: /Tlak ověřen/ }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Uložit' }));
    const n = Number(neq()!.replace(',', '.'));
    expect(n / 786.5 - 1).toBeGreaterThan(0.0005);
    expect(n / 786.5 - 1).toBeLessThan(0.002);
    expect(within(results()).queryByText(/není ověřen v podkladu výrobce/)).toBeNull();
    const saved = restoreBases(window.localStorage.getItem('odparovac.customBases.v1'));
    expect(saved).toHaveLength(1);
    expect(saved[0]!.pressure).toEqual({ value: 15, kind: 'abs' });
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(neq()).toBe('786,5');
  });
  it('nový základ bez tlaku a přiblížení → UA₁ nelze, aplikace nic nedoplňuje', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Nový základ' }));
    const editor = screen.getByRole('group', { name: 'Úprava katalogového základu' });
    type(within(editor).getByLabelText('Teplota okolí (katalog)') as HTMLInputElement, '4');
    fireEvent.click(within(editor).getByRole('button', { name: 'Uložit' }));
    expect(within(results()).getByText(/nemá uvedený tlak a přiblížení/)).toBeTruthy();
  });
  it('poškozená data vlastních základů se zahodí', () => {
    expect(restoreBases('[{"id":"x"}, {"id":"own-1","name":"a","T_amb_C":"nope"}]')).toEqual([]);
    expect(restoreBases('{')).toEqual([]);
  });
});

describe('stránka Ověření', () => {
  it('všechny referenční případy zeleně + poučný příklad LIN/LOX', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ověření' }));
    const n = runVerification().length;
    expect(screen.getByTestId('verify-status').textContent).toBe(`Všech ${n} referenčních případů kap. 9 prošlo`);
    expect(screen.getByTestId('verify-status').className).toContain('st-ok');
    expect(screen.queryAllByText('✗ CHYBA')).toHaveLength(0);
    expect(screen.getByText(/model konstantního U není katalog/)).toBeTruthy();
    expect(window.location.hash).toBe('#overeni');
  });
});
