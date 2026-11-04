// @vitest-environment jsdom
/**
 * UI testy fáze 2: výchozí případ dává stejná čísla jako jádro, změna látky,
 * okamžitý přepočet, semafor a pravidlo „žádné číslo bez jednotky a původu“.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultInput, evaluate, fmt } from '../src/core';
import { App } from '../src/ui/App';
import { formatEditable, parseNumber } from '../src/ui/components/fields';
import { restoreInput, STORAGE_KEY } from '../src/ui/state';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const results = () => document.querySelector('[data-results]') as HTMLElement;
const qText = () => screen.getByTestId('Q').querySelector('.num')!.textContent;
const input = (label: RegExp): HTMLInputElement => {
  const el = screen.getAllByLabelText(label).find((e) => e instanceof HTMLInputElement);
  if (!el) throw new Error(`pole ${label} nenalezeno`);
  return el as HTMLInputElement;
};
const type = (el: HTMLInputElement, value: string) => fireEvent.change(el, { target: { value } });

/**
 * Každý textový uzel s číslicí ve výsledcích musí ležet v <Qty> (číslo + jednotka + původ),
 * ve vzorci, nebo ve vysvětlujícím textu (zprávy kontrol, poznámky).
 */
function untaggedNumbers(root: HTMLElement): string[] {
  const bad: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? '';
    if (!/\d/.test(text)) continue;
    const el = n.parentElement!;
    // nadpisy jsou názvy sekcí (např. „Kontroly K1–K8“), ne hodnoty
    if (el.closest('[data-formula], [data-narrative], h1, h2, h3')) continue;
    const q = el.closest('[data-qty]');
    if (q && q.getAttribute('data-unit') && q.getAttribute('data-source') && q.querySelector('.src')) continue;
    bad.push(text);
  }
  return bad;
}

describe('výchozí případ', () => {
  it('O₂: Q v UI odpovídá jádru (139,71 kW) a referenci kap. 9', () => {
    render(<App />);
    const ev = evaluate(defaultInput('O2'));
    expect(qText()).toBe(fmt(ev.duty!.Q_kW, 2));
    expect(qText()).toBe('139,71');
    expect(screen.getByTestId('status').textContent).toBeTruthy();
  });

  it('Q má jednotku kW a štítek VÝPOČET', () => {
    render(<App />);
    const q = screen.getByTestId('Q').querySelector('[data-qty]')!;
    expect(q.getAttribute('data-unit')).toBe('kW');
    expect(q.getAttribute('data-source')).toBe('VYPOCET');
  });

  it('upozornění „není náhrada výběru a garance výrobce“ je viditelné', () => {
    render(<App />);
    expect(screen.getByRole('note').textContent).toContain('není náhradou výběru a garance výrobce');
  });
});

describe('žádné číslo bez jednotky a bez označení původu', () => {
  it.each([
    ['výchozí O₂', () => {}],
    ['N₂', () => fireEvent.click(screen.getByRole('radio', { name: /N₂/ }))],
    ['s dohřevem a TSL', () => {
      type(input(/Očekávaná výstupní teplota/), '-40');
      type(input(/Nastavení TSL/), '-28');
    }],
    ['neplatné vstupy', () => type(input(/Provozní tlak/), '50')],
  ])('%s', (_name, act) => {
    render(<App />);
    act();
    expect(untaggedNumbers(results())).toEqual([]);
  });
});

describe('interakce', () => {
  it('změna látky přenastaví teplotu kapaliny, rozsah tlaku a sloupec katalogu; Q = 129,34 kW', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    expect(input(/Teplota kapaliny/).value).toBe('-196');
    expect(screen.getByText(/Rozsah N₂: 1–32 bar a/)).toBeTruthy();
    expect(screen.getByText(/Sloupec katalogu pro N₂: LIN/)).toBeTruthy();
    expect(qText()).toBe('129,34');
    expect(screen.getByText(/Spotřeba LIN za den/)).toBeTruthy();
  });

  it('výsledky se přepočítají okamžitě; desetinná čárka ve vstupu', () => {
    render(<App />);
    type(input(/Návrhová výstupní teplota/), '-20');
    expect(qText()).toBe('143,39');
    type(input(/Teplota okolí pro výpočet/), '5,5');
    expect(qText()).toBe('143,39'); // výkon na teplotě okolí nezávisí
  });

  it('přepnutí přetlak → absolutní převede hodnotu, výkon se nezmění', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'absolutní' }));
    expect(input(/Provozní tlak/).value).toBe('6,01325');
    expect(qText()).toBe('139,71');
  });

  it('přepnutí jednotky průtoku převede hodnotu (1000 Nm³/h = 1054,9 Sm³/h)', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Jednotka průtoku'), { target: { value: 'Sm3/h' } });
    expect(input(/Špičkový návrhový průtok/).value).toBe('1054,9');
    expect(qText()).toBe('139,71');
  });

  it('nasycená kapalina: Q = 124,93 kW, pole teploty kapaliny zmizí', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /nasycená/ }));
    expect(qText()).toBe('124,93');
    expect(screen.queryAllByLabelText(/Teplota kapaliny/).filter((e) => e instanceof HTMLInputElement)).toHaveLength(0);
  });

  it('N₂ při 35 bar a → K2 CHYBA, stav „NEPLATNÉ – oprav vstupy“, výkon se nezobrazí', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'absolutní' }));
    type(input(/Provozní tlak/), '35');
    expect(screen.getByTestId('status').textContent).toBe('NEPLATNÉ – oprav vstupy');
    const k2 = document.querySelector('[data-check="K2"]')!;
    expect(k2.getAttribute('data-level')).toBe('CHYBA');
    expect(k2.textContent).toContain('nad kritickým tlakem dusíku');
    expect(screen.queryByTestId('Q')).toBeNull();
  });

  it('T_out −25 a TSL −25 → K8 CHYBA a „Výkon platný, ale NÁVRH NEVYHOVUJE – TSL“', () => {
    render(<App />);
    type(input(/Návrhová výstupní teplota/), '-25');
    type(input(/Nastavení TSL/), '-25');
    expect(screen.getByTestId('status').textContent).toBe('Výkon platný, ale NÁVRH NEVYHOVUJE – TSL');
    expect(document.querySelector('[data-check="K8"]')!.getAttribute('data-level')).toBe('CHYBA');
    expect(qText()).toBe('141,55');
  });

  it('nečitelné číslo → pole označené jako neplatné a K1 CHYBA', () => {
    render(<App />);
    type(input(/Špičkový návrhový průtok/), 'abc');
    expect(input(/Špičkový návrhový průtok/).getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('[data-check="K1"]')!.getAttribute('data-level')).toBe('CHYBA');
  });

  it('nápověda „proč na tom záleží“ se rozbalí kliknutím (i na tabletu)', () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /Proč na tom záleží: Nastavení TSL/ });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/TSL se nikdy nesnižuje/)).toBeTruthy();
  });

  it('všech 8 kontrol je v semaforu', () => {
    render(<App />);
    const list = within(results()).getAllByRole('listitem').filter((li) => li.hasAttribute('data-check'));
    expect(list.map((li) => li.getAttribute('data-check'))).toEqual(['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8']);
  });

  it('postup výpočtu ukazuje mezihodnoty (T_sat −161,66 °C)', () => {
    render(<App />);
    expect(within(results()).getAllByText('-161,661').length).toBeGreaterThan(0);
  });
});

describe('stav a úložiště', () => {
  it('poslední vstupy se obnoví z localStorage', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /N₂/ }));
    cleanup();
    render(<App />);
    expect(qText()).toBe('129,34');
  });
  it('poškozená data v úložišti → výchozí vstupy', () => {
    window.localStorage.setItem(STORAGE_KEY, '{nesmysl');
    render(<App />);
    expect(qText()).toBe('139,71');
    expect(restoreInput('{"fluid":"Xe"}').fluid).toBe('O2');
  });
});

describe('čtení čísel', () => {
  it('CZ i EN zápis', () => {
    expect(parseNumber('-5,5')).toBe(-5.5);
    expect(parseNumber('−5,5')).toBe(-5.5);
    expect(parseNumber('1 000')).toBe(1000);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('5,')).toBe(5);
    expect(Number.isNaN(parseNumber('-'))).toBe(true);
    expect(formatEditable(6.013249999999999)).toBe('6,01325');
  });
});
