/**
 * Lineární a bilineární interpolace na neekvidistantní, rostoucí mřížce.
 * Mimo mřížku nikdy neextrapoluje: vrací null a volající rozhodne o chybě.
 */

/** Relativní tolerance na hranách mřížky (zaokrouhlení vstupů). */
const EDGE_EPS = 1e-9;

export interface Bracket {
  i: number;
  /** Váha horního uzlu, 0..1. */
  t: number;
}

export function bracket(grid: readonly number[], x: number): Bracket | null {
  const n = grid.length;
  if (n < 2 || !Number.isFinite(x)) return null;
  const lo = grid[0]!;
  const hi = grid[n - 1]!;
  const eps = EDGE_EPS * Math.max(1, Math.abs(lo), Math.abs(hi));
  if (x < lo - eps || x > hi + eps) return null;
  if (x <= lo) return { i: 0, t: 0 };
  if (x >= hi) return { i: n - 2, t: 1 };
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (grid[m]! <= x) a = m;
    else b = m;
  }
  const x0 = grid[a]!;
  const x1 = grid[a + 1]!;
  return { i: a, t: (x - x0) / (x1 - x0) };
}

export function lerpAt(values: readonly number[], br: Bracket): number {
  const v0 = values[br.i]!;
  const v1 = values[br.i + 1]!;
  return v0 + (v1 - v0) * br.t;
}

export function interp1(grid: readonly number[], values: readonly number[], x: number): number | null {
  const br = bracket(grid, x);
  return br === null ? null : lerpAt(values, br);
}

/** Bilineární interpolace, z[i][j] odpovídá (xGrid[i], yGrid[j]). */
export function interp2(
  xGrid: readonly number[],
  yGrid: readonly number[],
  z: readonly (readonly number[])[],
  x: number,
  y: number,
): number | null {
  const bx = bracket(xGrid, x);
  const by = bracket(yGrid, y);
  if (bx === null || by === null) return null;
  const r0 = z[bx.i]!;
  const r1 = z[bx.i + 1]!;
  const a = lerpAt(r0, by);
  const b = lerpAt(r1, by);
  return a + (b - a) * bx.t;
}
