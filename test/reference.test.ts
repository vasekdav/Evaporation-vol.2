/**
 * Akceptační testy – referenční případy z kapitoly 9 zadání (CoolProp 7.2.0,
 * h = 0 pro nasycenou kapalinu při 1,01325 bar, V̇n = 1000 Nm³/h).
 * Hodnoty jsou přepsané ze zadání, nikoli vygenerované.
 */
import { describe, expect, it } from 'vitest';
import {
  computeDuty,
  defaultInput,
  evaluate,
  findBasis,
  getProvider,
  reheat,
  catalogUA1,
  sizeBranch,
  type DutyInput,
  type FluidId,
} from '../src/core';
import arRef from '../src/data/reference/Ar.json';
import { expectAbs, expectRel, TOL } from './helpers';

const P6 = 6.01325;
const chart = findBasis('chart-supergap-eu')!;

type Row = { name: string; p: number; Tout: number; Tin: number | null; Q: number; QI?: number; QII?: number };

const duty = (fluid: FluidId, r: { p: number; Tout: number; Tin: number | null }) =>
  computeDuty(getProvider(fluid), {
    Vn_Nm3_h: 1000,
    p_bar_a: r.p,
    T_out_C: r.Tout,
    liquid: r.Tin === null ? { kind: 'saturated' } : { kind: 'subcooled', T_C: r.Tin },
  } satisfies DutyInput);

function neq(fluid: FluidId, T_des_C: number, T_out_C: number, Tin: number): number {
  const props = getProvider(fluid);
  const d = duty(fluid, { p: P6, Tout: T_out_C, Tin });
  const s = sizeBranch(props, d, chart, T_des_C, 1);
  if (!s.ok) throw new Error(s.reason);
  return s.N_eq_Nm3_h;
}

// ---------------------------------------------------------------- 9.1 O2
describe('9.1 Kyslík (O₂)', () => {
  const props = getProvider('O2');

  it('vlastnosti', () => {
    expectAbs(props.meta.rho_n_kg_Nm3, 1.429033, 5e-7);
    expectAbs(props.meta.nbp_C, -182.962, TOL.T_K);
    expectRel(props.meta.r_atm_kJ_kg, 213.06);
    // i z tabulky (interpolace při 1,01325 bar)
    const atm = props.sat(1.01325);
    expectAbs(atm.T_sat_C, -182.962, TOL.T_K);
    expectRel(atm.r_kJ_kg, 213.06);
    expectAbs(atm.h_l_kJ_kg, 0, TOL.H_KJ_KG);

    const s = props.sat(P6);
    expectAbs(s.T_sat_C, -161.661, TOL.T_K);
    expectAbs(s.r_kJ_kg, 187.53, TOL.H_KJ_KG);
    expectAbs(s.h_l_kJ_kg, 37.448, TOL.H_KJ_KG);
    expectAbs(s.h_v_kJ_kg, 224.978, TOL.H_KJ_KG);
    expectAbs(props.gasH(P6, -30), 352.16, TOL.H_KJ_KG);
    expectAbs(props.liquid(P6, -183).h_kJ_kg, 0.202, TOL.H_KJ_KG);
  });

  const rows: Row[] = [
    { name: 'Výchozí', p: P6, Tout: -30, Tin: -183, Q: 139.711 },
    { name: 'Nasycená', p: P6, Tout: -30, Tin: null, Q: 124.926 },
    { name: 'T_out −25', p: P6, Tout: -25, Tin: -183, Q: 141.552 },
    { name: 'T_out −20', p: P6, Tout: -20, Tin: -183, Q: 143.393 },
    { name: '5 bar a', p: 5.0, Tout: -30, Tin: null, Q: 127.011 },
    { name: '40 bar a, −124,8 °C', p: 40, Tout: -30, Tin: -124.8, Q: 87.033 },
    { name: '40 bar a, −183 °C', p: 40, Tout: -30, Tin: -183, Q: 134.019 },
    { name: 'Mimo mřížku', p: 20.5, Tout: -57.5, Tin: -150.5, Q: 103.692 },
  ];
  it.each(rows)('Q: $name', (r) => expectRel(duty('O2', r).Q_kW, r.Q));

  it('velikost: UA₁ a N_eq (Chart SuperGap EU, LOX, k = 1)', () => {
    const ua1 = catalogUA1(props, chart);
    expect(ua1.ok).toBe(true);
    if (ua1.ok) expectAbs(ua1.UA1_W_K_per_Nm3h, 1.5229, 5e-4);
    expectRel(neq('O2', 0, -30, -183), 786.5, TOL.REL);
    expectRel(neq('O2', -15, -30, -183), 973.6, TOL.REL);
    expectRel(neq('O2', -15, -20, -183), 1247.8, TOL.REL);
  });

  it('dohřev', () => {
    const m = duty('O2', { p: P6, Tout: -30, Tin: -183 }).m_kg_s;
    expectRel(reheat(props, m, P6, -40, -30)!.Q_kW, 3.686);
    expectRel(reheat(props, m, P6, -40, -20)!.Q_kW, 7.37);
  });
});

// ---------------------------------------------------------------- 9.2 N2
describe('9.2 Dusík (N₂)', () => {
  const props = getProvider('N2');

  it('vlastnosti', () => {
    expectAbs(props.meta.rho_n_kg_Nm3, 1.250386, 5e-7);
    expectAbs(props.meta.nbp_C, -195.795, TOL.T_K);
    expectRel(props.meta.r_atm_kJ_kg, 199.18);
    const atm = props.sat(1.01325);
    expectAbs(atm.T_sat_C, -195.795, TOL.T_K);
    expectRel(atm.r_kJ_kg, 199.18);

    const s = props.sat(P6);
    expectAbs(s.T_sat_C, -176.74, TOL.T_K);
    expectAbs(s.r_kJ_kg, 168.609, TOL.H_KJ_KG);
    expectAbs(s.h_l_kJ_kg, 40.603, TOL.H_KJ_KG);
    expectAbs(s.h_v_kJ_kg, 209.212, TOL.H_KJ_KG);
    expectAbs(props.gasH(P6, -30), 372.308, TOL.H_KJ_KG);
    expectAbs(props.liquid(P6, -196).h_kJ_kg, -0.068, TOL.H_KJ_KG);
  });

  const rows: Row[] = [
    { name: 'Výchozí', p: P6, Tout: -30, Tin: -196, Q: 129.337, QI: 72.689, QII: 56.648 },
    { name: 'Nasycená', p: P6, Tout: -30, Tin: null, Q: 115.211, QI: 58.563, QII: 56.648 },
    { name: 'T_out −25', p: P6, Tout: -25, Tin: -196, Q: 131.169 },
    { name: 'T_out −20', p: P6, Tout: -20, Tin: -196, Q: 133.0 },
    { name: '5 bar a', p: 5.0, Tout: -30, Tin: null, Q: 117.2 },
    { name: '15 barg', p: 16.01325, Tout: -20, Tin: -196, Q: 131.675 },
    { name: '30 bar a, nasycená', p: 30, Tout: -30, Tin: null, Q: 84.914, QI: 22.668, QII: 62.245 },
    { name: '30 bar a, −196 °C', p: 30, Tout: -30, Tin: -196, Q: 125.952 },
  ];
  it.each(rows)('Q: $name', (r) => {
    const d = duty('N2', r);
    expectRel(d.Q_kW, r.Q);
    if (r.QI !== undefined) expectRel(d.Q_I_kW, r.QI);
    if (r.QII !== undefined) expectRel(d.Q_II_kW, r.QII);
  });

  it('velikost: UA₁ a N_eq (Chart SuperGap EU, LIN, k = 1, 5 barg, −196 °C)', () => {
    const ua1 = catalogUA1(props, chart);
    expect(ua1.ok).toBe(true);
    if (ua1.ok) expectAbs(ua1.UA1_W_K_per_Nm3h, 1.4503, 5e-4);
    expectRel(neq('N2', 0, -30, -196), 755.6, TOL.REL);
    expectRel(neq('N2', -15, -30, -196), 942.8, TOL.REL);
    expectRel(neq('N2', -15, -25, -196), 1049.5, TOL.REL);
    expectRel(neq('N2', -15, -20, -196), 1232.3, TOL.REL);
  });

  it('dohřev (6,01325 bar a)', () => {
    const m = duty('N2', { p: P6, Tout: -30, Tin: -196 }).m_kg_s;
    expectRel(reheat(props, m, P6, -40, -30)!.Q_kW, 3.669);
    expectRel(reheat(props, m, P6, -40, -20)!.Q_kW, 7.332);
  });

  it('kontroly: 35 bar a → K2 CHYBA „nad kritickým tlakem dusíku, mimo rozsah“', () => {
    const e = evaluate({ ...defaultInput('N2'), pressure: { value: 35, kind: 'abs' } });
    const k2 = e.checks.find((c) => c.id === 'K2')!;
    expect(k2.level).toBe('CHYBA');
    expect(k2.message).toContain('nad kritickým tlakem dusíku');
    expect(k2.message).toContain('mimo rozsah');
    expect(e.status).toBe('INVALID');
    expect(e.duty).toBeNull();
  });

  it('kontroly: kapalina −215 °C → K5 CHYBA (pod trojným bodem)', () => {
    const e = evaluate({ ...defaultInput('N2'), liquid: { kind: 'subcooled', T_C: -215 } });
    const k5 = e.checks.find((c) => c.id === 'K5')!;
    expect(k5.level).toBe('CHYBA');
    expect(k5.message).toContain('pod trojným bodem');
    expect(e.status).toBe('INVALID');
    expect(e.duty).toBeNull();
  });
});

// ---------------------------------------------------------------- 9.3 společné
describe('9.3 Společné kontroly', () => {
  it.each(['O2', 'N2'] as FluidId[])('%s: T_out −25 °C a TSL −25 °C → K8 CHYBA, „Výkon platný, ale NÁVRH NEVYHOVUJE“', (f) => {
    const e = evaluate({ ...defaultInput(f), T_out_C: -25, TSL_C: -25 });
    const k8 = e.checks.find((c) => c.id === 'K8')!;
    expect(k8.level).toBe('CHYBA');
    expect(k8.blocking).toBe(false);
    expect(e.status).toBe('DESIGN_FAILS');
    expect(e.statusText).toBe('Výkon platný, ale NÁVRH NEVYHOVUJE – TSL');
    expect(e.duty).not.toBeNull();
  });

  it.each(['O2', 'N2'] as FluidId[])('%s: T_min −35 °C a T_out −30 °C → K4 POZOR, posouzení velikosti „nelze“', (f) => {
    const e = evaluate({ ...defaultInput(f), T_min_site_C: -35, T_out_C: -30 });
    const k4 = e.checks.find((c) => c.id === 'K4')!;
    expect(k4.level).toBe('POZOR');
    // T_des −35 °C ≤ mez potrubí −30 °C: výstup bude v mrazu nutně pod mezí → návrh nevyhovuje (nezávislá kontrola)
    expect(e.status).toBe('DESIGN_FAILS');
    expect(e.statusText).toBe('Výkon platný, ale NÁVRH NEVYHOVUJE – křehký lom');
    expect(e.duty).not.toBeNull();
    expect(e.sizing?.ok).toBe(false);
    if (e.sizing && !e.sizing.ok) expect(e.sizing.reason).toContain('nelze');
  });
});

// ---------------------------------------------------------------- end-to-end
describe('Výchozí vstupy end-to-end', () => {
  it('O₂: 1000 Nm³/h, 5 barg, −183 °C → −30 °C, okolí 0 °C', () => {
    const e = evaluate(defaultInput('O2'));
    expect(e.status).not.toBe('INVALID');
    expectAbs(e.p_bar_a!, P6, 1e-12);
    expectRel(e.duty!.Q_kW, 139.711);
    expect(e.sizing?.ok).toBe(true);
    if (e.sizing?.ok) {
      expectRel(e.sizing.N_eq_Nm3_h, 786.5, TOL.REL);
      expect(e.sizing.minBranchCapacity_Nm3_h).toBe(1000); // MAX(V̇n, N_eq·k)
    }
  });
  it('N₂: 1000 Nm³/h, 5 barg, −196 °C → −30 °C, okolí 0 °C', () => {
    const e = evaluate(defaultInput('N2'));
    expectRel(e.duty!.Q_kW, 129.337);
    if (e.sizing?.ok) expectRel(e.sizing.N_eq_Nm3_h, 755.6, TOL.REL);
    else throw new Error('sizing');
  });
});

// ---------------------------------------------------------------- 9.x Ar (fáze 5)
// Zadání: „Pro Ar si referenční případy vygeneruj z CoolProp stejnou sadou případů jako v 9.1 a 9.2.“
// Reference src/data/reference/Ar.json počítá tools/gen_tables.py PŘÍMO ze stavové rovnice
// (Tegeler et al. 1999 v CoolProp 7.2.0), nezávisle na tabulkách, ze kterých počítá aplikace.

describe('Argon (Ar) – reference vygenerované z CoolProp', () => {
  const props = getProvider('Ar');
  const Tin = arRef.T_in_default_C;

  it('reference z CoolProp 7.2.0, výchozí kapalina −186 °C', () => {
    expect(arRef.coolprop_version).toBe('7.2.0');
    expect(Tin).toBe(-186);
    expect(props.meta.eos).toBe('Tegeler et al. (1999)');
  });

  it('vlastnosti', () => {
    const r = arRef.props;
    expectAbs(props.meta.rho_n_kg_Nm3, r.rho_n, 5e-7);
    expectAbs(props.sat(1.01325).T_sat_C, r.nbp, TOL.T_K);
    expectRel(props.sat(1.01325).r_kJ_kg, r.r_atm);
    const s = props.sat(P6);
    expectAbs(s.T_sat_C, r.Tsat, TOL.T_K);
    expectAbs(s.r_kJ_kg, r.r, TOL.H_KJ_KG);
    expectAbs(s.h_l_kJ_kg, r.hl, TOL.H_KJ_KG);
    expectAbs(s.h_v_kJ_kg, r.hv, TOL.H_KJ_KG);
    expectAbs(props.gasH(P6, -30), r.hgas, TOL.H_KJ_KG);
    expectAbs(props.liquid(P6, Tin).h_kJ_kg, r.hliq, TOL.H_KJ_KG);
  });

  it.each(arRef.cases)('Q: $name', (c) => {
    const d = duty('Ar', c);
    expectRel(d.Q_kW, c.Q);
    if ('QI' in c && c.QI !== undefined) expectRel(d.Q_I_kW, c.QI);
    if ('QII' in c && c.QII !== undefined) expectRel(d.Q_II_kW, c.QII);
  });

  it('velikost: UA₁ a N_eq (Chart SuperGap EU, k = 1)', () => {
    const ua1 = catalogUA1(props, chart);
    expect(ua1.ok).toBe(true);
    if (ua1.ok) expectAbs(ua1.UA1_W_K_per_Nm3h, arRef.ua1_chart, 5e-4);
    for (const n of arRef.neq) expectRel(neq('Ar', n.Ta, n.Tout, Tin), n.N, TOL.REL);
  });

  it('dohřev (6,01325 bar a)', () => {
    const m = duty('Ar', { p: P6, Tout: -30, Tin }).m_kg_s;
    for (const r of arRef.reheat) expectRel(reheat(props, m, P6, -40, r.to)!.Q_kW, r.Q);
  });

  it('kontroly: 41 bar a → K2 CHYBA; kapalina −195 °C → K5 CHYBA (pod trojným bodem); 40 bar a OK', () => {
    const k = (e: ReturnType<typeof evaluate>, id: string) => e.checks.find((c) => c.id === id)!;
    expect(k(evaluate({ ...defaultInput('Ar'), pressure: { value: 41, kind: 'abs' } }), 'K2').level).toBe('CHYBA');
    const e5 = evaluate({ ...defaultInput('Ar'), liquid: { kind: 'subcooled', T_C: -195 } });
    expect(k(e5, 'K5').level).toBe('CHYBA');
    expect(k(e5, 'K5').message).toContain('pod trojným bodem');
    expect(evaluate({ ...defaultInput('Ar'), pressure: { value: 40, kind: 'abs' } }).duty).not.toBeNull();
  });

  it('výchozí vstupy end-to-end: Ar 1000 Nm³/h, 5 barg, −186 °C → −30 °C', () => {
    const e = evaluate(defaultInput('Ar'));
    expectRel(e.duty!.Q_kW, arRef.cases[0]!.Q);
    if (e.sizing?.ok) expectRel(e.sizing.N_eq_Nm3_h, arRef.neq[0]!.N, TOL.REL);
    else throw new Error('sizing');
  });
});
