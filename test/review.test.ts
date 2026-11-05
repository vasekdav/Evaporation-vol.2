/**
 * Regresní testy k nálezům nezávislé odborné kontroly (fyzika, praxe, bezpečnost, SW).
 * Každý test odkazuje na nález, který pokrývá.
 */
import { describe, expect, it } from 'vitest';
import { defaultInput, evaluate, findBasis, getProvider, type CatalogBasis, type DesignInput } from '../src/core';
import { restoreBases, restoreInput, sanitizeInput } from '../src/core/restore';
import { parseCase } from '../src/report/caseFile';

const lvl = (e: ReturnType<typeof evaluate>, id: string) => e.checks.find((c) => c.id === id)!;

describe('bezpečnost – stav výsledku nesmí pustit nebezpečné kombinace', () => {
  it('T_min ≤ mez potrubí a T_out nad mezí → K6 CHYBA „křehký lom“, návrh nevyhovuje (bez dohřevu)', () => {
    const e = evaluate({ ...defaultInput('O2'), T_min_site_C: -35, T_out_C: -25, T_pipe_min_C: -30 });
    expect(lvl(e, 'K6').level).toBe('CHYBA');
    expect(lvl(e, 'K6').blocking).toBe(false);
    expect(e.status).toBe('DESIGN_FAILS');
    expect(e.statusText).toBe('Výkon platný, ale NÁVRH NEVYHOVUJE – křehký lom');
    expect(e.duty).not.toBeNull();
  });
  it('se zadaným dohřevem jen POZOR v K6 a D2 hlídá úsek před dohřevem', () => {
    const e = evaluate({ ...defaultInput('O2'), T_min_site_C: -35, T_out_C: -25, T_actual_out_C: -40, TSL_C: -28 });
    expect(lvl(e, 'K6').level).toBe('POZOR');
    expect(lvl(e, 'D2').level).toBe('POZOR');
    expect(lvl(e, 'D2').message).toContain('z nerezu');
  });
  it('T_skut bez dohřevu pod mezí potrubí → D2 POZOR (dříve „Všechny kontroly OK“)', () => {
    const e = evaluate({ ...defaultInput('N2'), T_out_C: -20, T_actual_out_C: -45, TSL_C: -28, T_min_site_C: -10 });
    expect(lvl(e, 'D2').level).toBe('POZOR');
    expect(e.status).toBe('VALID_WITH_WARNINGS');
  });
  it('chybějící TSL a T_min → stav „Neúplné“, ne „Všechny kontroly OK“', () => {
    const e = evaluate({ ...defaultInput('O2'), T_out_C: -20 });
    expect(e.status).toBe('INCOMPLETE');
    expect(e.statusText).toBe('Neúplné – chybí: TSL, min. teplota lokality');
  });
  it('TSL rovno mezi potrubí → K8 POZOR (dříve OK)', () => {
    const e = evaluate({ ...defaultInput('O2'), T_out_C: -20, TSL_C: -30, T_min_site_C: -5 });
    expect(lvl(e, 'K8').level).toBe('POZOR');
    expect(lvl(e, 'K8').message).toContain('přesnost čidla');
  });
  it('odkaz na AIGA 027 čl. 9.2.2.1 jen u TSL pod mezí potrubí', () => {
    const vypinal = evaluate({ ...defaultInput('O2'), T_out_C: -25, TSL_C: -25 });
    expect(lvl(vypinal, 'K8').reference).toBe('AIGA 027');
    const podMezi = evaluate({ ...defaultInput('O2'), T_out_C: -20, TSL_C: -32 });
    expect(lvl(podMezi, 'K8').reference).toBe('AIGA 027 čl. 9.2.2.1');
  });
  it('rezerva nad TSL menší než výchozí 5 K → D3 INFO', () => {
    const e = evaluate({ ...defaultInput('O2'), TSL_margin_K: 0, T_out_C: -25, TSL_C: -25.5 });
    expect(lvl(e, 'D3').level).toBe('INFO');
  });
});

describe('fyzika – věrohodnost a meze modelu', () => {
  it('Ar nad ~14 bar a: −189 °C je pod křivkou tání (pevná fáze) → K5 CHYBA', () => {
    const e = evaluate({ ...defaultInput('Ar'), pressure: { value: 40, kind: 'abs' }, liquid: { kind: 'subcooled', T_C: -189 } });
    expect(lvl(e, 'K5').level).toBe('CHYBA');
    expect(lvl(e, 'K5').message).toContain('pod křivkou tání');
    expect(e.duty).toBeNull();
    expect(getProvider('Ar').meltT_C(40)).toBeCloseTo(-188.36, 1);
    // při 1 bar a je −189 °C nad křivkou tání → kapalina
    expect(lvl(evaluate({ ...defaultInput('Ar'), pressure: { value: 1, kind: 'abs' }, liquid: { kind: 'subcooled', T_C: -189 } }), 'K5').level).toBe('OK');
  });
  it('O₂ a N₂: dolní meze tabulek leží nad křivkou tání v celém rozsahu', () => {
    for (const [f, p] of [['O2', 40], ['N2', 32]] as const) {
      const prov = getProvider(f);
      expect(prov.meta.T_liq_min_C).toBeGreaterThan(prov.meltT_C(p));
    }
  });
  it('k < 1 a přiblížení pod 3 K → D3 POZOR', () => {
    expect(lvl(evaluate({ ...defaultInput('O2'), k: 0.5 }), 'D3').level).toBe('POZOR');
    expect(lvl(evaluate({ ...defaultInput('O2'), T_amb_C: -28, T_out_C: -30 }), 'D3').message).toContain('mimo věrohodnost');
  });
  it('nesmyslné okolní podmínky blokuje K1', () => {
    for (const bad of [{ T_amb_C: 200 }, { T_min_site_C: -150 }, { p_atm_bar_a: 5 }, { flow: { value: 1e9, unit: 'Nm3/h' as const } }])
      expect(evaluate({ ...defaultInput('O2'), ...bad } as DesignInput).status).toBe('INVALID');
  });
});

describe('praxe – provoz vs. katalogový základ', () => {
  it('24/7 v mrazu proti katalogovým 8 h → D4 POZOR', () => {
    const e = evaluate({ ...defaultInput('N2'), continuous24_7: true, T_amb_C: -15, T_out_C: -25 });
    expect(lvl(e, 'D4').level).toBe('POZOR');
    expect(lvl(e, 'D4').message).toContain('8 h');
  });
  it('8 h/den nebo bez mrazu → D4 OK', () => {
    expect(lvl(evaluate(defaultInput('N2')), 'D4').level).toBe('OK');
  });
});

describe('software – robustnost vůči poškozeným datům', () => {
  const bads: unknown[] = [
    { fluid: 'O2', flow: {} },
    { fluid: 'O2', flow: { value: 'x', unit: 'Nm3/h' } },
    { fluid: 'O2', flow: { value: 1, unit: 'toString' } },
    { fluid: 'O2', flow: { value: 1, unit: '__proto__' } },
    { fluid: 'O2', liquid: { kind: 'subcooled' } },
    { fluid: 'O2', pressure: {} },
    { fluid: 'O2', T_out_C: '-30' },
    { fluid: 'O2', catalogBasisId: 42 },
    { fluid: 'O2', continuous24_7: 'no' },
    { fluid: 'O2', availability: 'vždy' },
    { fluid: 'O2', avgFlow: 5 },
    { fluid: 'N2', TSL_C: {} },
    [1, 2, 3],
    'text',
    null,
  ];
  it.each(bads.map((b) => [JSON.stringify(b), b]))('sanitizeInput(%s) dá platné výchozí hodnoty', (_s, b) => {
    const inp = sanitizeInput(b);
    const e = evaluate(inp);
    expect(e.status).not.toBe('INVALID');
    expect(typeof inp.continuous24_7).toBe('boolean');
    expect(['Nm3/h', 'Sm3/h', 'scfh60', 'scfh70']).toContain(inp.flow.unit);
  });
  it('restoreInput nepropustí neznámé klíče ani prototyp', () => {
    const r = restoreInput('{"fluid":"N2","__proto__":{"polluted":1},"evil":"x"}') as unknown as Record<string, unknown>;
    expect(r.evil).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('vlastní základy: neplatné rozsahy se zahodí', () => {
    const chart = findBasis('chart-supergap-eu')!;
    const ok: CatalogBasis = { ...chart, id: 'own-1', name: 'A' };
    expect(restoreBases(JSON.stringify([ok]))).toHaveLength(1);
    for (const bad of [{ approach_K: -50 }, { RH_pct: 500 }, { T_amb_C: 60 }, { pressure: { value: -1, kind: 'abs' } }, { name: '' }])
      expect(restoreBases(JSON.stringify([{ ...ok, ...bad }]))).toEqual([]);
  });
  it('vlastní základ mimo rozsah tabulek nezneplatní výkon, jen posouzení velikosti', () => {
    const chart = findBasis('chart-supergap-eu')!;
    const odd: CatalogBasis = { ...chart, id: 'own-x', name: 'X', T_amb_C: 50, approach_K: 0.1, pressure: { value: 39, kind: 'gauge' } };
    const e = evaluate({ ...defaultInput('O2'), catalogBasisId: 'own-x' }, { extraBases: [odd] });
    expect(e.duty).not.toBeNull();
    expect(e.sizing?.ok).toBe(false);
    if (e.sizing && !e.sizing.ok) expect(e.sizing.reason).toContain('Katalogový základ');
  });
  it('soubor případu s poškozenými vnořenými daty se načte s výchozími hodnotami', () => {
    const p = parseCase('{"app":"odparovac","schema":1,"input":{"fluid":"N2","flow":{},"liquid":{"kind":"subcooled"}},"inquiry":{"a":1,"b":"ok"}}');
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.input.flow).toEqual(defaultInput('N2').flow);
    expect(p.input.liquid).toEqual(defaultInput('N2').liquid);
    expect(p.inquiry).toEqual({ b: 'ok' });
  });
});

describe('dávka 2 – velikost a S3', () => {
  it('kontrola stávajícího odpařovače: pod průtokem / pod ideální mezí / nad mezí s výhradou', async () => {
    const { assessExisting } = await import('../src/core/sizing');
    const e = evaluate({ ...defaultInput('O2'), T_amb_C: -15, T_out_C: -20 });
    if (!e.sizing?.ok) throw new Error('sizing');
    expect(assessExisting(900, e.sizing, 1000).verdict).toBe('BELOW_FLOW');
    expect(assessExisting(1100, e.sizing, 1000).verdict).toBe('BELOW_IDEAL'); // N_eq 1247,8
    const a = assessExisting(1290, e.sizing, 1000);
    expect(a.verdict).toBe('ABOVE_PRACTICE');
    expect(a.text).toContain('NEZNAMENÁ, že vyhoví');
    const e0 = evaluate(defaultInput('O2'));
    if (!e0.sizing?.ok) throw new Error('sizing');
    expect(assessExisting(1100, e0.sizing, 1000).verdict).toBe('ABOVE_IDEAL_BELOW_PRACTICE');
  });
  it('spotřeba: objem i jako kapalina při 1,01325 bar (N₂ 32 bar nasycená)', () => {
    const e = evaluate({ ...defaultInput('N2'), pressure: { value: 32, kind: 'abs' }, liquid: { kind: 'saturated' } });
    const c = e.consumptionPerDay!;
    expect(c.volume_nbp_m3).not.toBeNull();
    expect(c.volume_m3 / c.volume_nbp_m3!).toBeGreaterThan(1.8); // ρ 428 vs. 807 kg/m³
  });
  it('upozornění u velikosti: LMTD text odpovídá nezávislé kontrole (ne „na bezpečné straně“)', () => {
    const e = evaluate(defaultInput('O2'));
    if (!e.sizing?.ok) throw new Error('sizing');
    const w = e.sizing.warnings.join(' ');
    expect(w).not.toContain('na bezpečné straně');
    expect(w).toContain('1,5–4,5 % NÍŽ');
  });
});
