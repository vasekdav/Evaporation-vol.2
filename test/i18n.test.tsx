// @vitest-environment jsdom
/**
 * Přepínání jazyka (CZ / EN) a barevného režimu (světlý / tmavý).
 * V angličtině nesmí na žádné stránce zůstat český text (kontrola znaků s háčky a čárkami).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultInput, evaluate } from '../src/core';
import { getLang, setLang } from '../src/core/i18n';
import { buildReport } from '../src/report/model';
import { App } from '../src/ui/App';
import { formatEditable, parseNumber } from '../src/ui/components/fields';
import { LANG_KEY, THEME_KEY } from '../src/ui/state';
import { untaggedNumbers } from './uiHelpers';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  setLang('cs');
});

const qText = () => screen.getByTestId('Q').querySelector('.num')!.textContent;
// česká písmena, která v angličtině nemají co dělat (ČSN je název normy)
const czech = (text: string) => (text.replace(/ČSN/g, '').match(/[^\n]*[ěščřžůáíéýúĚŠČŘŽŮÁÍÉÝÚťďňŤĎŇ][^\n]*/g) ?? []).map((s) => s.trim());
const toEnglish = () => fireEvent.click(screen.getByRole('radio', { name: 'EN' }));
const pages = ['Calculation & design', 'Design procedure', 'Enquiry', 'Why not kW', 'Equations', 'Verification', 'Sources'];

describe('jazyk', () => {
  it('výchozí je čeština (prohlížeč cs), přepnutí na EN přeloží UI a uloží volbu', () => {
    render(<App />);
    expect(qText()).toBe('139,71');
    toEnglish();
    expect(getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LANG_KEY)).toBe('en');
    const nav = screen.getByRole('navigation', { name: 'Pages' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(pages);
    expect(qText()).toBe('139.71');
    expect(screen.getByRole('heading', { name: 'Inputs' })).toBeTruthy();
    expect(screen.getByTestId('status').textContent).toMatch(/[A-Za-z]/);
    // zpět do češtiny
    fireEvent.click(screen.getByRole('radio', { name: 'CZ' }));
    expect(qText()).toBe('139,71');
    expect(screen.getByRole('navigation', { name: 'Stránky' })).toBeTruthy();
  });

  it('uložená volba EN platí po novém načtení; vstupy píší desetinnou tečku', () => {
    window.localStorage.setItem(LANG_KEY, 'en');
    render(<App />);
    expect(getLang()).toBe('en');
    expect(qText()).toBe('139.71');
    expect(formatEditable(6.01325)).toBe('6.01325');
    expect(parseNumber('1,000.5')).toBe(1000.5);
    expect(parseNumber('1,5')).toBe(1.5);
  });

  it.each([
    ['O2', {}],
    ['N2', { fluid: 'N2' }],
    ['Ar s TSL, dohřevem a 24/7', { fluid: 'Ar', TSL_C: -25, T_actual_out_C: -40, continuous24_7: true, T_min_site_C: -20 }],
  ])('EN: na žádné stránce nezůstane český text (%s)', (_n, patch) => {
    const input = { ...defaultInput((patch as { fluid?: 'O2' | 'N2' | 'Ar' }).fluid ?? 'O2'), ...patch };
    window.localStorage.setItem(LANG_KEY, 'en');
    window.localStorage.setItem('odparovac.lastInput.v1', JSON.stringify(input));
    render(<App />);
    const found: string[] = [];
    for (const p of pages) {
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Pages' })).getByRole('button', { name: p }));
      // rozbalit nápovědy a podrobnosti, ať se zkontroluje i skrytý text
      document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
      found.push(...czech(document.body.textContent ?? '').map((s) => `${p}: ${s}`));
      for (const el of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')))
        found.push(...czech(el.value).map((s) => `${p} value: ${s}`));
      for (const el of Array.from(document.querySelectorAll('[aria-label], [placeholder], [title]')))
        for (const a of ['aria-label', 'placeholder', 'title'])
          found.push(...czech(el.getAttribute(a) ?? '').map((s) => `${p} @${a}: ${s}`));
    }
    expect(found).toEqual([]);
  });

  it('EN: nápovědy „Why it matters“ jsou anglicky', () => {
    window.localStorage.setItem(LANG_KEY, 'en');
    render(<App />);
    for (const b of screen.getAllByRole('button', { name: /^Why it matters/ })) fireEvent.click(b);
    expect(czech(document.querySelector('.inputs')!.textContent ?? '')).toEqual([]);
  });

  it('EN: žádné číslo bez jednotky a původu', () => {
    window.localStorage.setItem(LANG_KEY, 'en');
    render(<App />);
    expect(untaggedNumbers(document.querySelector('[data-results]') as HTMLElement)).toEqual([]);
  });

  it('EN: ověření kap. 9 projde celé', () => {
    window.localStorage.setItem(LANG_KEY, 'en');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Verification' }));
    expect(screen.getByTestId('verify-status').textContent).toMatch(/^All \d+ reference cases/);
  });

  it('EN: report (PDF / Excel model) je anglicky a se stejnými čísly', () => {
    setLang('en');
    const ev = evaluate(defaultInput());
    const m = buildReport(ev, { kind: 'report', basis: undefined, inquiry: {}, appVersion: 't', now: new Date(0) });
    const all = JSON.stringify(m);
    expect(czech(all)).toEqual([]);
    expect(m.sections.find((s) => s.id === 'inputs')?.title).toBe('Inputs');
    const inq = buildReport(ev, { kind: 'inquiry', basis: undefined, inquiry: {}, appVersion: 't', now: new Date(0) });
    expect(czech(JSON.stringify(inq))).toEqual([]);
  });
});

describe('barevný režim', () => {
  it('přepínač nastaví data-theme a uloží volbu', () => {
    render(<App />);
    const group = screen.getByRole('radiogroup', { name: 'Barevný režim' });
    fireEvent.click(within(group).getByRole('radio', { name: /Tmavý/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    fireEvent.click(within(group).getByRole('radio', { name: /Světlý/ }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('uložená volba platí po novém načtení', () => {
    window.localStorage.setItem(THEME_KEY, 'dark');
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(within(screen.getByRole('radiogroup', { name: 'Barevný režim' })).getByRole('radio', { name: /Tmavý/ }).getAttribute('aria-checked')).toBe('true');
  });
});
