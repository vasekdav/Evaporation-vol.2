/** Fáze 3 – koncept, citlivost, ověření. */
import { describe, expect, it } from 'vitest';
import {
  computeDuty,
  defaultInput,
  evaluate,
  findBasis,
  getProvider,
  linLoxLesson,
  recommendConcept,
  runVerification,
  sweepAmbientTemp,
  sweepHumidity,
  sweepOutletTemp,
  type ConceptInput,
} from '../src/core';
import { expectAbs, expectRel } from './helpers';

const base: ConceptInput = {
  hoursPerDay: 8,
  continuous24_7: false,
  frostWeeks: null,
  T_des_C: 0,
  T_out_C: -30,
  TSL_C: null,
  TSL_margin_K: 5,
  availability: 'N',
};
const ids = (r: ReturnType<typeof recommendConcept>) => r.items.map((i) => `${i.id}:${i.role}`);

describe('doporučení konceptu (kap. 6.3)', () => {
  it('≤ 8 h/den s odstávkou → jedna větev', () => {
    const r = recommendConcept(base);
    expect(ids(r)).toEqual(['SINGLE:doporučeno']);
    expect(r.threeVariants).toBeNull();
  });
  it('24/7 → dvě přepínané větve; přepínání nenahrazuje TSL', () => {
    const r = recommendConcept({ ...base, continuous24_7: true });
    expect(ids(r)[0]).toBe('SWITCHED:doporučeno');
    expect(r.items[0]!.why.join(' ')).toContain('24/7');
  });
  it('12 h/den → dvě přepínané větve', () => {
    expect(ids(recommendConcept({ ...base, hoursPerDay: 12 }))[0]).toBe('SWITCHED:doporučeno');
  });
  it('mráz: jedna větev jen při dimenzování na mrazové období; mrazové týdny → zvážit přepínání; chybějící týdny → poznámka', () => {
    const r = recommendConcept({ ...base, T_des_C: -15 });
    expect(r.items[0]!.why.join(' ')).toContain('mrazové období');
    expect(r.notes.join(' ')).toContain('Délka mrazového období není zadaná');
    const r2 = recommendConcept({ ...base, T_des_C: -15, frostWeeks: 10 });
    expect(ids(r2)).toContain('SWITCHED:zvážit');
  });
  it('T_out ≥ T_des → dohřev jako doplněk, vodní lázeň zvážit', () => {
    const r = recommendConcept({ ...base, T_des_C: -35, T_out_C: -30 });
    expect(ids(r)).toContain('ATM_HEATER:doplněk');
    expect(ids(r)).toContain('WATER_BATH:zvážit');
  });
  it('přiblížení < 10 K → dohřev, nucený tah a vodní lázeň zvážit', () => {
    const r = recommendConcept({ ...base, T_des_C: -15, T_out_C: -20 });
    expect(r.approach_K).toBe(5);
    expect(ids(r)).toEqual(expect.arrayContaining(['ATM_HEATER:zvážit', 'FORCED_DRAFT:zvážit', 'WATER_BATH:zvážit']));
  });
  it('přiblížení přesně 10 K → bez alternativ', () => {
    const r = recommendConcept({ ...base, T_des_C: -10, T_out_C: -20 });
    expect(ids(r).filter((x) => x.endsWith('zvážit'))).toEqual([]);
  });
  it('dostupnost N+1 a záložní ohřívač', () => {
    expect(ids(recommendConcept({ ...base, availability: 'N+1' }))).toContain('N_PLUS_1:doplněk');
    expect(ids(recommendConcept({ ...base, availability: 'backup-heater' }))).toContain('WATER_BATH:doplněk');
  });
  it('tři varianty (a)/(b)/(c) jen při přiblížení < 10 K A ZÁROVEŇ T_out − TSL < rezerva', () => {
    const yes = recommendConcept({ ...base, T_des_C: -15, T_out_C: -20, TSL_C: -22, TSL_margin_K: 5 });
    expect(yes.threeVariants?.variants.map((v) => v.key)).toEqual(['a', 'b', 'c']);
    expect(yes.threeVariants?.note).toContain('analýzy rizik');
    // malé přiblížení, ale dostatečná rezerva nad TSL
    expect(recommendConcept({ ...base, T_des_C: -15, T_out_C: -20, TSL_C: -28 }).threeVariants).toBeNull();
    // malá rezerva, ale přiblížení ≥ 10 K
    expect(recommendConcept({ ...base, T_des_C: 0, T_out_C: -20, TSL_C: -22 }).threeVariants).toBeNull();
    // TSL nezadané
    expect(recommendConcept({ ...base, T_des_C: -15, T_out_C: -20 }).threeVariants).toBeNull();
  });
  it('evaluate předává koncept; při neplatných vstupech žádný', () => {
    expect(evaluate(defaultInput('O2')).concept?.items[0]!.id).toBe('SINGLE');
    expect(evaluate({ ...defaultInput('O2'), T_out_C: 5 }).concept).toBeNull();
  });
});

describe('citlivost', () => {
  const props = getProvider('O2');
  const chart = findBasis('chart-supergap-eu')!;
  const duty = { Vn_Nm3_h: 1000, p_bar_a: 6.01325, liquid: { kind: 'subcooled', T_C: -183 }, T_out_C: -30 } as const;

  it('vs. výstupní teplota: Q roste s T_out; N_eq odpovídá kap. 9; nad T_des N_eq = null', () => {
    const pts = sweepOutletTemp(props, duty, chart, -15, [-30, -25, -20, -15, -10]);
    expectRel(pts[0]!.Q_kW!, 139.711);
    expectRel(pts[2]!.Q_kW!, 143.393);
    expectRel(pts[0]!.N_eq_Nm3_h!, 973.6);
    expectRel(pts[2]!.N_eq_Nm3_h!, 1247.8);
    expect(pts[3]!.N_eq_Nm3_h).toBeNull();
    expect(pts[4]!.N_eq_Nm3_h).toBeNull();
  });
  it('vs. teplota okolí −20 až +20 °C: Q konstantní, N_eq klesá s teplotou', () => {
    const pts = sweepAmbientTemp(props, duty, chart);
    expect(pts).toHaveLength(41);
    expect(pts[0]!.x).toBe(-20);
    expect(pts[40]!.x).toBe(20);
    const Qs = pts.map((p) => p.Q_kW!);
    expect(Math.max(...Qs) - Math.min(...Qs)).toBeLessThan(1e-9);
    const n = pts.map((p) => p.N_eq_Nm3_h!);
    for (let i = 1; i < n.length; i++) expect(n[i]!).toBeLessThan(n[i - 1]!);
    expectRel(pts.find((p) => p.x === 0)!.N_eq_Nm3_h!, 786.5);
  });
  it('vs. teplota okolí: pod T_out N_eq = null', () => {
    const pts = sweepAmbientTemp(props, { ...duty, T_out_C: -10 }, chart, [-20, -10, 0]);
    expect(pts[0]!.N_eq_Nm3_h).toBeNull();
    expect(pts[1]!.N_eq_Nm3_h).toBeNull();
    expect(pts[2]!.N_eq_Nm3_h).not.toBeNull();
  });
  it('absolutní vlhkost vs. teplota', () => {
    const pts = sweepHumidity(85);
    const at = (T: number) => pts.find((p) => p.T_C === T)!;
    expectAbs(at(-15).x_RH_g_kg, 0.86, 0.005);
    expect(at(20).x_sat_g_kg).toBeGreaterThan(at(-20).x_sat_g_kg * 10);
  });
  it('mimo rozsah tabulek bod vrací null, neextrapoluje', () => {
    const pts = sweepOutletTemp(props, duty, chart, 0, [-70]);
    expect(pts[0]!.Q_kW).toBeNull();
    // kontrola, že jádro by opravdu vyhodilo chybu
    expect(() => computeDuty(props, { ...duty, T_out_C: -70 })).toThrow();
  });
});

describe('ověření (stránka Ověření)', () => {
  it('všechny referenční případy kap. 9 projdou', () => {
    const rows = runVerification();
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.filter((r) => !r.pass).map((r) => `${r.fluid} ${r.name}`)).toEqual([]);
    expect(new Set(rows.map((r) => r.fluid))).toEqual(new Set(['O2', 'N2', 'společné']));
  });
  it('LIN/LOX: fyzika 1,050, katalog Chart 1,084–1,091 (zadání uvádí ≈ 1,085–1,087)', () => {
    const l = linLoxLesson()!;
    expectAbs(l.physicsRatio, 1.05, 0.0005);
    // z tabulky modelů kap. 7: min 770/710 = 1,0845 (SG270HF), max 1200/1100 = 1,0909 (SG430HF)
    expectAbs(l.catalogMin, 1.0843, 0.0005);
    expectAbs(l.catalogMax, 1.0909, 0.0005);
    expect(l.catalogMin - l.physicsRatio).toBeGreaterThan(0.03);
  });
});
