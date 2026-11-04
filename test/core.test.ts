/** Jednotkové testy jádra mimo referenční případy kap. 9. */
import { describe, expect, it } from 'vitest';
import {
  absoluteHumidity_g_kg,
  catalogUA1,
  CATALOG_MODEL_SETS,
  checkK1,
  checkK4,
  checkK6,
  checkK7,
  checkK8,
  computeDuty,
  consumption,
  defaultInput,
  evaluate,
  findBasis,
  FLUID_POLICY,
  fromNm3h,
  getProvider,
  latentPotential_kJ_kg,
  modelsAtOrAbove,
  overallStatus,
  PropertyRangeError,
  requiredUA,
  saturationPressure_hPa,
  toAbsBar,
  toNm3h,
  withFluid,
  type CatalogBasis,
} from '../src/core';
import { bracket, interp1, interp2 } from '../src/core/properties/interp';
import { expectAbs, expectRel } from './helpers';

describe('jednotky', () => {
  it('přetlak → absolutní tlak', () => {
    expect(toAbsBar({ value: 5, kind: 'gauge' })).toBeCloseTo(6.01325, 12);
    expect(toAbsBar({ value: 5, kind: 'gauge' }, 0.98)).toBeCloseTo(5.98, 12);
    expect(toAbsBar({ value: 6, kind: 'abs' }, 0.98)).toBe(6);
  });
  it('průtok: 1 Nm³ = 1,0549 Sm³ ≈ 37,3 scf (60 °F) ≈ 38,0 scf (70 °F)', () => {
    expect(toNm3h({ value: 1054.9, unit: 'Sm3/h' })).toBeCloseTo(1000, 9);
    expect(fromNm3h(1, 'scfh60')).toBe(37.3);
    expect(fromNm3h(1, 'scfh70')).toBe(38.0);
  });
});

describe('interpolace – nikdy neextrapoluje', () => {
  const g = [0, 1, 3];
  it('uvnitř a na hranách', () => {
    expect(interp1(g, [0, 10, 30], 2)).toBe(20);
    expect(interp1(g, [0, 10, 30], 0)).toBe(0);
    expect(interp1(g, [0, 10, 30], 3)).toBe(30);
    expect(interp2([0, 1], [0, 1], [[0, 1], [2, 3]], 0.5, 0.5)).toBe(1.5);
  });
  it('mimo mřížku vrací null', () => {
    expect(bracket(g, -0.001)).toBeNull();
    expect(bracket(g, 3.001)).toBeNull();
    expect(bracket(g, Number.NaN)).toBeNull();
  });
  it('provider mimo rozsah vyhodí PropertyRangeError', () => {
    const o2 = getProvider('O2');
    const n2 = getProvider('N2');
    expect(() => o2.sat(40.5)).toThrow(PropertyRangeError);
    expect(() => n2.sat(33)).toThrow(PropertyRangeError);
    expect(() => o2.sat(0.9)).toThrow(PropertyRangeError);
    expect(() => o2.gasH(6, -61)).toThrow(PropertyRangeError);
    expect(() => o2.gasH(6, 41)).toThrow(PropertyRangeError);
    expect(() => n2.liquid(6, -209.5)).toThrow(PropertyRangeError);
    expect(() => n2.liquid(6, -170)).toThrow(/nad teplotou nasycení/);
  });
});

describe('výkon – rozklad a odvozené veličiny', () => {
  const o2 = getProvider('O2');
  const d = computeDuty(o2, { Vn_Nm3_h: 1000, p_bar_a: 6.01325, T_out_C: -30, liquid: { kind: 'subcooled', T_C: -183 } });

  it('q = q₁ + q₂ + q₃, Q = Q_I + Q_II, Q_sat = Q − ṁ·q₁', () => {
    expectAbs(d.q_kJ_kg, d.q1_kJ_kg + d.q2_kJ_kg + d.q3_kJ_kg, 1e-12);
    expectAbs(d.Q_kW, d.Q_I_kW + d.Q_II_kW, 1e-12);
    expectAbs(d.Q_sat_kW, d.Q_kW - d.m_kg_s * d.q1_kJ_kg, 1e-12);
    expectRel(d.Q_sat_kW, 124.926);
    expectAbs(d.q_kJ_kg, d.h_out_kJ_kg - d.h_in_kJ_kg, 1e-12);
  });
  it('ṁ = V̇n·ρn/3600', () => {
    expectAbs(d.m_kg_s, (1000 * 1.429033) / 3600, 1e-6);
  });
  it('střední c_p kapaliny jen při |T_sat − T_in| ≥ 1 K', () => {
    expect(d.cp_l_mean_kJ_kgK).not.toBeNull();
    const near = computeDuty(o2, {
      Vn_Nm3_h: 1000,
      p_bar_a: 40,
      T_out_C: -30,
      liquid: { kind: 'subcooled', T_C: -124.8 },
    });
    expect(near.cp_l_mean_kJ_kgK).toBeNull(); // T_sat(40 bar a) = −124,49 °C
    expect(d.cp_g_mean_kJ_kgK).toBeGreaterThan(0.9);
  });
  it('tlaková ztráta 0,5 bar zvýší Q zhruba o 0,05 % (zanedbáno, kap. 5.2)', () => {
    for (const f of ['O2', 'N2'] as const) {
      const p = getProvider(f);
      const a = computeDuty(p, {
        Vn_Nm3_h: 1000,
        p_bar_a: 6.01325,
        T_out_C: -30,
        liquid: { kind: 'subcooled', T_C: FLUID_POLICY[f].T_in_default_C },
      });
      const Q2 = a.m_kg_s * (p.gasH(6.01325 - 0.5, -30) - a.h_in_kJ_kg);
      const rel = Q2 / a.Q_kW - 1;
      expect(rel).toBeGreaterThan(0.0003);
      expect(rel).toBeLessThan(0.0007);
    }
  });
  it('spotřeba: m = ṁ·t, V = m/ρ_in', () => {
    const c = consumption(d, 8);
    expectAbs(c.mass_kg, d.m_kg_h * 8, 1e-9);
    expectAbs(c.volume_m3, c.mass_kg / d.rho_in_kg_m3, 1e-12);
    expect(d.rho_in_kg_m3).toBeGreaterThan(1100); // LOX ~1140 kg/m³
  });
});

describe('velikost', () => {
  it('poměr UA₁(O₂)/UA₁(N₂) = 1,050 – katalog Chart LIN/LOX ≈ 1,085 (model konst. U ≠ katalog)', () => {
    const chart = findBasis('chart-supergap-eu')!;
    const a = catalogUA1(getProvider('O2'), chart);
    const b = catalogUA1(getProvider('N2'), chart);
    if (!a.ok || !b.ok) throw new Error('UA1');
    expectAbs(a.UA1_W_K_per_Nm3h / b.UA1_W_K_per_Nm3h, 1.05, 0.0005);
    const ratios = CATALOG_MODEL_SETS[0]!.models.map((m) => m.LIN / m.LOX);
    for (const r of ratios) expect(r).toBeGreaterThan(1.08);
  });
  it('neúplný katalogový základ (Tekoma bez tlaku a přiblížení) → UA₁ nelze, nevymýšlí se', () => {
    const r = catalogUA1(getProvider('O2'), findBasis('tekoma-cryonorm')!);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/tlak a přiblížení/);
  });
  it('vlastní katalogový základ uživatele', () => {
    const own: CatalogBasis = {
      ...findBasis('chart-supergap-eu')!,
      id: 'own',
      name: 'Vlastní',
      pressure: { value: 16.01325, kind: 'abs' },
    };
    const e = evaluate({ ...defaultInput('O2'), catalogBasisId: 'own' }, { extraBases: [own] });
    expect(e.sizing?.ok).toBe(true);
    if (e.sizing?.ok) expectRel(e.sizing.N_eq_Nm3_h, 786.5);
  });
  it('k násobí N_eq; nejmenší kapacita = MAX(V̇n, N_eq·k); tepelná náročnost = N_eq·k/V̇n', () => {
    const e = evaluate({ ...defaultInput('O2'), T_amb_C: -15, T_out_C: -20, k: 1.3 });
    if (!e.sizing?.ok) throw new Error('sizing');
    expectRel(e.sizing.N_eq_Nm3_h, 1247.8);
    expectRel(e.sizing.minBranchCapacity_Nm3_h, 1247.8 * 1.3);
    expectRel(e.sizing.thermalDemand, (1247.8 * 1.3) / 1000);
    expect(e.sizing.warnings.join(' ')).toContain('OPTIMISTICKÝ');
  });
  it('velikost se posuzuje při MIN(T_okolí, T_min,lokality)', () => {
    const e = evaluate({ ...defaultInput('O2'), T_amb_C: 0, T_min_site_C: -15 });
    expect(e.T_des_C).toBe(-15);
    if (!e.sizing?.ok) throw new Error('sizing');
    expectRel(e.sizing.N_eq_Nm3_h, 973.6);
  });
  it('ΔT_out ≤ 0 → „atmosférický odpařovač výstupní teploty nedosáhne“', () => {
    const r = requiredUA({ Q_I_kW: 1, Q_II_kW: 1, T_sat_C: -160, T_out_C: -20 }, -20);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('nedosáhne');
  });
  it('katalogový sloupec odpovídá látce: O₂ → LOX, N₂ → LIN', () => {
    const set = CATALOG_MODEL_SETS[0]!;
    expect(FLUID_POLICY.O2.catalogColumn).toBe('LOX');
    expect(FLUID_POLICY.N2.catalogColumn).toBe('LIN');
    expect(modelsAtOrAbove(set, 'LOX', 1000).map((m) => m.model)[0]).toBe('SG430HF');
    expect(modelsAtOrAbove(set, 'LIN', 1000).map((m) => m.model)[0]).toBe('SG360HF');
  });
});

describe('psychrometrie (vysvětlující model, kap. 5.5)', () => {
  it('−15 °C / 85 % nad ledem: 0,86 g/kg', () => {
    expectAbs(absoluteHumidity_g_kg(-15, 85), 0.86, 0.005);
  });
  it('20 °C / 75 %: předepsaný Magnus dává 10,93 g/kg (zadání uvádí 10,95)', () => {
    // Přesně podle vzorce z kap. 5.5 vychází 10,928 g/kg. Referenci 10,95 by dal
    // e_s(20 °C) ≈ 23,37 hPa místo 23,33 hPa z Magnusu – rozdíl 0,2 % je v konstantách,
    // ne v implementaci. Ponecháno k potvrzení uživatelem.
    expectAbs(absoluteHumidity_g_kg(20, 75), 10.928, 0.001);
    expectAbs(absoluteHumidity_g_kg(20, 75), 10.95, 0.03);
  });
  it('Magnus: voda nad 0 °C, led pod 0 °C', () => {
    expectAbs(saturationPressure_hPa(0), 6.112, 1e-12);
    expect(saturationPressure_hPa(-0.001)).toBeLessThan(6.112);
  });
  it('latentní potenciál ~2,8 kJ na 1 g vymrzlé vody', () => {
    expectAbs(latentPotential_kJ_kg(1), 2.834, 1e-12);
  });
});

describe('kontroly K1–K8 – větve logiky', () => {
  it('K1: chybějící výběr blokuje', () => {
    const k = checkK1({ ...defaultInput('O2'), catalogBasisId: 'neexistuje' });
    expect(k.level).toBe('CHYBA');
    expect(k.blocking).toBe(true);
    const e = evaluate({ ...defaultInput('O2'), flow: { value: 0, unit: 'Nm3/h' } });
    expect(e.status).toBe('INVALID');
    expect(e.checks.filter((c) => c.level === 'NEHODNOCENO')).toHaveLength(7);
  });
  it('K2: O₂ 40 bar a OK, 40,5 bar a CHYBA; N₂ 33 bar a CHYBA (blízko kritického tlaku)', () => {
    expect(evaluate({ ...defaultInput('O2'), pressure: { value: 40, kind: 'abs' } }).status).not.toBe('INVALID');
    expect(evaluate({ ...defaultInput('O2'), pressure: { value: 40.5, kind: 'abs' } }).status).toBe('INVALID');
    const e = evaluate({ ...defaultInput('N2'), pressure: { value: 33, kind: 'abs' } });
    expect(e.checks.find((c) => c.id === 'K2')!.message).toContain('blízko kritického tlaku');
  });
  it('K3: T_out mimo −60 až +40 °C blokuje', () => {
    expect(evaluate({ ...defaultInput('O2'), T_out_C: -61, T_pipe_min_C: -70 }).status).toBe('INVALID');
  });
  it('K4: T_out ≥ T_okolí CHYBA (blokuje), T_out ≥ T_des POZOR', () => {
    expect(checkK4(0, 0, 0).level).toBe('CHYBA');
    expect(checkK4(0, 0, 0).blocking).toBe(true);
    expect(checkK4(-30, 0, -30).level).toBe('POZOR');
    expect(checkK4(-30, 0, -30).blocking).toBe(false);
    expect(checkK4(-30, 0, -15).level).toBe('OK');
  });
  it('K5: O₂ −218,5 °C pod mezí tabulky, nad nasycením CHYBA, nasycená OK', () => {
    const e1 = evaluate({ ...defaultInput('O2'), liquid: { kind: 'subcooled', T_C: -218.5 } });
    expect(e1.checks.find((c) => c.id === 'K5')!.message).toContain('pod dolní mezí tabulky');
    const e2 = evaluate({ ...defaultInput('O2'), liquid: { kind: 'subcooled', T_C: -150 } });
    expect(e2.checks.find((c) => c.id === 'K5')!.message).toContain('nad teplotou nasycení');
    expect(e2.status).toBe('INVALID');
    expect(evaluate({ ...defaultInput('O2'), liquid: { kind: 'saturated' } }).duty).not.toBeNull();
  });
  it('K6: pod mezí CHYBA (blokuje), rovno POZOR „bez rezervy“, nad OK s AIGA 027', () => {
    expect(checkK6(-31, -30).level).toBe('CHYBA');
    expect(checkK6(-31, -30).blocking).toBe(true);
    expect(checkK6(-30, -30).level).toBe('POZOR');
    expect(checkK6(-30, -30).message).toContain('bez rezervy');
    expect(checkK6(-20, -30).message).toContain('TSL doporučuje AIGA 027');
  });
  it('K7: nezadáno / INFO / OK', () => {
    expect(checkK7(0, null).level).toBe('NEZADÁNO');
    expect(checkK7(0, -15).level).toBe('INFO');
    expect(checkK7(-20, -15).level).toBe('OK');
  });
  it('K8: TSL pod mezí potrubí CHYBA (9.2.2.1), malá rezerva POZOR, hierarchie −30/−28/−20 OK', () => {
    const a = checkK8(-20, -30, -32, 5);
    expect(a.level).toBe('CHYBA');
    expect(a.message).toContain('9.2.2.1');
    expect(checkK8(-25, -30, -28, 5).level).toBe('POZOR');
    expect(checkK8(-20, -30, -28, 5).level).toBe('OK');
    expect(checkK8(-20, -30, null, 5).level).toBe('NEZADÁNO');
    expect(checkK8(-20, -30, -32, 5).blocking).toBe(false);
  });
  it('stav výsledku', () => {
    expect(evaluate({ ...defaultInput('O2'), TSL_C: -28, T_out_C: -20 }).statusText).toBe('Všechny kontroly OK');
    expect(evaluate({ ...defaultInput('O2'), T_out_C: -30 }).statusText).toBe('Platné – ale viz POZOR'); // K6 rovno mezi
    expect(overallStatus([])).toBe('ALL_OK');
  });
});

describe('vstupy', () => {
  it('změna látky přenastaví výchozí teplotu kapaliny', () => {
    const n = withFluid(defaultInput('O2'), 'N2');
    expect(n.liquid).toEqual({ kind: 'subcooled', T_C: -196 });
  });
  it('dohřev v evaluate: −40 → −30 °C', () => {
    const e = evaluate({ ...defaultInput('O2'), T_actual_out_C: -40 });
    expect(e.reheat?.ok).toBe(true);
    if (e.reheat?.ok) expectRel(e.reheat.Q_kW, 3.686);
    const bad = evaluate({ ...defaultInput('O2'), T_actual_out_C: -70 });
    expect(bad.reheat?.ok).toBe(false);
  });
});
