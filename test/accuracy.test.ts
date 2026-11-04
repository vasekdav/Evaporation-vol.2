/**
 * Přesnost tabulek proti přímému výpočtu z CoolProp 7.2.0 (kap. 3: ≤ 0,1 % výkonu
 * v celém rozsahu; kap. 9: teploty ±0,05 K). Body generuje tools/gen_tables.py.
 */
import { describe, expect, it } from 'vitest';
import O2 from './fixtures/coolprop-validation-O2.json';
import N2 from './fixtures/coolprop-validation-N2.json';
import { computeDuty } from '../src/core/duty';
import { getProvider, type FluidId } from '../src/core/properties';

interface Case {
  p: number;
  Tout: number;
  Tin: number | null;
  Tsat: number;
  Q: number;
  QI: number;
  QII: number;
  rhoIn: number;
}

const SETS: Record<FluidId, { Vn_Nm3_h: number; cases: Case[] }> = {
  O2: O2 as never,
  N2: N2 as never,
};

const TOL_Q_REL = 1e-3;
const TOL_T_K = 0.05;

describe.each(['O2', 'N2'] as FluidId[])('přesnost tabulek %s vs. CoolProp', (fluid) => {
  const set = SETS[fluid];
  const props = getProvider(fluid);

  it(`${set.cases.length} bodů: Q, Q_I, Q_II ≤ 0,1 %, T_sat ≤ 0,05 K, ρ_in ≤ 0,1 %`, () => {
    const worst = { Q: 0, QI: 0, QII: 0, T: 0, rho: 0 };
    const worstCase: Record<string, Case | undefined> = {};
    for (const c of set.cases) {
      const d = computeDuty(props, {
        Vn_Nm3_h: set.Vn_Nm3_h,
        p_bar_a: c.p,
        T_out_C: c.Tout,
        liquid: c.Tin === null ? { kind: 'saturated' } : { kind: 'subcooled', T_C: c.Tin },
      });
      const errs = {
        Q: Math.abs(d.Q_kW / c.Q - 1),
        QI: Math.abs(d.Q_I_kW / c.QI - 1),
        QII: Math.abs(d.Q_II_kW / c.QII - 1),
        T: Math.abs(d.T_sat_C - c.Tsat),
        rho: Math.abs(d.rho_in_kg_m3 / c.rhoIn - 1),
      };
      for (const k of Object.keys(errs) as (keyof typeof errs)[]) {
        if (errs[k] > worst[k]) {
          worst[k] = errs[k];
          worstCase[k] = c;
        }
      }
    }
    // Souhrn do výstupu testu (dokládá přesnost, kap. 3).
    console.info(
      `[${fluid}] max. odchylka: Q ${(worst.Q * 100).toFixed(4)} %, Q_I ${(worst.QI * 100).toFixed(4)} %, ` +
        `Q_II ${(worst.QII * 100).toFixed(4)} %, T_sat ${worst.T.toFixed(4)} K, ρ_in ${(worst.rho * 100).toFixed(4)} %`,
    );
    if (worst.Q > TOL_Q_REL) console.info('nejhorší Q', worstCase.Q);
    if (worst.QI > TOL_Q_REL) console.info('nejhorší Q_I', worstCase.QI);
    if (worst.rho > TOL_Q_REL) console.info('nejhorší rho', worstCase.rho);
    expect(worst.Q).toBeLessThanOrEqual(TOL_Q_REL);
    expect(worst.QI).toBeLessThanOrEqual(TOL_Q_REL);
    expect(worst.QII).toBeLessThanOrEqual(TOL_Q_REL);
    expect(worst.T).toBeLessThanOrEqual(TOL_T_K);
    expect(worst.rho).toBeLessThanOrEqual(TOL_Q_REL);
  });
});
