// @vitest-environment jsdom
/** UI testy fáze 5: argon. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import arRef from '../src/data/reference/Ar.json';
import { fmt } from '../src/core';
import { App } from '../src/ui/App';
import { untaggedNumbers } from './uiHelpers';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const results = () => document.querySelector('[data-results]') as HTMLElement;
const inputEl = (re: RegExp) => screen.getAllByLabelText(re).find((e) => e instanceof HTMLInputElement) as HTMLInputElement;
const selectAr = () => fireEvent.click(screen.getByRole('radio', { name: /Ar argon/ }));

describe('argon v UI', () => {
  it('volba Ar: −186 °C, rozsah 1–40 bar a, sloupec LAR, Q a N_eq podle reference z CoolProp', () => {
    render(<App />);
    selectAr();
    expect(inputEl(/^Teplota kapaliny/).value).toBe('-186');
    expect(screen.getByText(/Rozsah Ar: 1–40 bar a/)).toBeTruthy();
    expect(screen.getByText(/Sloupec katalogu pro Ar: LAR/)).toBeTruthy();
    expect(screen.getByTestId('Q').querySelector('.num')!.textContent).toBe(fmt(arRef.cases[0]!.Q, 2));
    expect(screen.getByTestId('Neq').querySelector('.num')!.textContent).toBe(fmt(arRef.neq[0]!.N, 1));
    expect(screen.getByText(/Spotřeba LAR za den/)).toBeTruthy();
  });
  it('katalog nemá sloupec LAR → žádné modely, žádný přepočet z LOX/LIN', () => {
    render(<App />);
    selectAr();
    expect(screen.getByTestId('no-column').textContent).toContain('nemá sloupec LAR');
    expect(within(results()).queryByText('SG430HF')).toBeNull();
    expect(untaggedNumbers(results())).toEqual([]);
  });
  it('poptávka: skupina 2 (argon), běžná čistota; postup: argon je těžší než vzduch', () => {
    render(<App />);
    selectAr();
    fireEvent.click(screen.getByRole('button', { name: 'Poptávka' }));
    const val = (re: RegExp) => (screen.getAllByLabelText(re).find((e) => e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) as HTMLInputElement).value;
    expect(val(/^Skupina tekutiny/)).toBe('skupina 2 (argon)');
    expect(val(/^Požadavek/)).toBe('běžná čistota pro kryogenní službu');
    expect(val(/^Médium/)).toContain('LAR');
    fireEvent.click(screen.getByRole('button', { name: 'Postup návrhu' }));
    expect(screen.getByText(/Argon je těžší než vzduch/)).toBeTruthy();
  });
  it('Ověření: obsahuje případy Ar a vše prošlo', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ověření' }));
    expect(screen.getByTestId('verify-status').className).toContain('st-ok');
    expect(screen.getAllByRole('cell', { name: 'Ar' }).length).toBeGreaterThan(30);
  });
});
