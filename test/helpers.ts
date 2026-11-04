import { expect } from 'vitest';

/** Tolerance akceptačních kritérií (kap. 9). */
export const TOL = {
  /** výkon ±0,1 % */
  Q_REL: 1e-3,
  /** teploty ±0,05 K */
  T_K: 0.05,
  /**
   * Entalpie: zadání toleranci neuvádí; použijeme ±0,02 kJ/kg (≈ 0,01 % celkové q),
   * což je přísnější než tolerance výkonu.
   */
  H_KJ_KG: 0.02,
  /** N_eq a další odvozené veličiny relativně jako výkon */
  REL: 1e-3,
} as const;

export function expectRel(actual: number, expected: number, tol: number = TOL.Q_REL): void {
  const rel = Math.abs(actual / expected - 1);
  expect(rel, `skutečnost ${actual} vs. reference ${expected} (odchylka ${(rel * 100).toFixed(4)} %)`).toBeLessThanOrEqual(tol);
}

export function expectAbs(actual: number, expected: number, tol: number): void {
  const d = Math.abs(actual - expected);
  expect(d, `skutečnost ${actual} vs. reference ${expected} (odchylka ${d.toFixed(5)})`).toBeLessThanOrEqual(tol);
}
