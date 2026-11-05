/**
 * Bezpečné obnovení vstupů a vlastních katalogových základů z uložených dat
 * (localStorage, soubor případu, odkaz). Každé pole se ověřuje podle typu včetně
 * vnořených objektů; neznámá nebo poškozená data se nahradí výchozími.
 */
import type { CatalogBasis } from './catalog';
import { defaultInput, type Availability, type DesignInput } from './input';
import { FLUID_IDS, type FluidId } from './properties/types';
import { FLOW_PER_NM3, type FlowUnit, type FlowValue, type PressureValue } from './units';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function flow(x: unknown): FlowValue | null {
  if (!isObj(x) || !num(x.value) || typeof x.unit !== 'string' || !own(FLOW_PER_NM3, x.unit)) return null;
  return { value: x.value, unit: x.unit as FlowUnit };
}
function pressure(x: unknown): PressureValue | null {
  if (!isObj(x) || !num(x.value) || (x.kind !== 'gauge' && x.kind !== 'abs')) return null;
  return { value: x.value, kind: x.kind };
}
const numOr = (x: unknown, d: number) => (num(x) ? x : d);
const numOrNull = (x: unknown, d: number | null) => (x === null ? null : num(x) ? x : d);

/** Sloučí uložená data s výchozími; každé pole ověří podle typu. */
export function sanitizeInput(data: unknown): DesignInput {
  if (!isObj(data) || typeof data.fluid !== 'string' || !FLUID_IDS.includes(data.fluid as FluidId)) return defaultInput();
  const d = defaultInput(data.fluid as FluidId);
  const liq = data.liquid;
  const liquid: DesignInput['liquid'] =
    isObj(liq) && liq.kind === 'saturated'
      ? { kind: 'saturated' }
      : isObj(liq) && liq.kind === 'subcooled' && num(liq.T_C)
        ? { kind: 'subcooled', T_C: liq.T_C }
        : d.liquid;
  const avail: Availability[] = ['N', 'N+1', 'backup-heater'];
  return {
    fluid: d.fluid,
    flow: flow(data.flow) ?? d.flow,
    avgFlow: data.avgFlow === null ? null : flow(data.avgFlow),
    pressure: pressure(data.pressure) ?? d.pressure,
    p_atm_bar_a: numOr(data.p_atm_bar_a, d.p_atm_bar_a),
    liquid,
    T_amb_C: numOr(data.T_amb_C, d.T_amb_C),
    T_min_site_C: numOrNull(data.T_min_site_C, d.T_min_site_C),
    RH_winter_pct: numOr(data.RH_winter_pct, d.RH_winter_pct),
    frostWeeks: numOrNull(data.frostWeeks, d.frostWeeks),
    T_pipe_min_C: numOr(data.T_pipe_min_C, d.T_pipe_min_C),
    T_out_C: numOr(data.T_out_C, d.T_out_C),
    TSL_C: numOrNull(data.TSL_C, d.TSL_C),
    TSL_margin_K: numOr(data.TSL_margin_K, d.TSL_margin_K),
    hoursPerDay: numOr(data.hoursPerDay, d.hoursPerDay),
    continuous24_7: typeof data.continuous24_7 === 'boolean' ? data.continuous24_7 : d.continuous24_7,
    availability: avail.includes(data.availability as Availability) ? (data.availability as Availability) : d.availability,
    T_actual_out_C: numOrNull(data.T_actual_out_C, d.T_actual_out_C),
    catalogBasisId:
      typeof data.catalogBasisId === 'string' && data.catalogBasisId.length > 0 && data.catalogBasisId.length <= 100
        ? data.catalogBasisId
        : d.catalogBasisId,
    k: numOr(data.k, d.k),
  };
}

export function restoreInput(raw: string | null): DesignInput {
  if (!raw) return defaultInput();
  try {
    return sanitizeInput(JSON.parse(raw));
  } catch {
    return defaultInput();
  }
}

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const optRange = (x: unknown, lo: number, hi: number): number | null | undefined =>
  x === null || x === undefined ? null : num(x) && x >= lo && x <= hi ? x : undefined;

/** Jeden vlastní katalogový základ; null, pokud je neplatný. */
export function sanitizeBasis(b: unknown): CatalogBasis | null {
  if (!isObj(b) || typeof b.id !== 'string' || !b.id.startsWith('own-') || b.id.length > 64) return null;
  if (typeof b.name !== 'string' || b.name.trim() === '') return null;
  if (!num(b.T_amb_C) || b.T_amb_C < -50 || b.T_amb_C > 50) return null;
  const p = b.pressure === null || b.pressure === undefined ? null : pressure(b.pressure);
  if (b.pressure !== null && b.pressure !== undefined && (!p || p.value <= 0 || p.value > 100)) return null;
  const RH = optRange(b.RH_pct, 0, 100);
  const approach = optRange(b.approach_K, 0.1, 60);
  const runtime = optRange(b.runtime_h, 0.1, 168);
  const wind = optRange(b.wind_m_s, 0, 50);
  const hp = optRange(b.hpLinedFactor, 0.1, 1.5);
  if ([RH, approach, runtime, wind, hp].some((v) => v === undefined)) return null;
  return {
    id: b.id,
    name: str(b.name, 200),
    manufacturer: str(b.manufacturer, 200) || 'vlastní',
    T_amb_C: b.T_amb_C,
    RH_pct: RH ?? null,
    pressure: p,
    pressureVerified: p === null ? null : typeof b.pressureVerified === 'boolean' ? b.pressureVerified : null,
    approach_K: approach ?? null,
    runtime_h: runtime ?? null,
    wind_m_s: wind ?? null,
    hpLinedFactor: hp ?? null,
    note: str(b.note, 2000),
    source: str(b.source, 500) || 'vlastní zadání',
    modelsId: typeof b.modelsId === 'string' ? b.modelsId.slice(0, 100) : null,
  };
}

/** Načte vlastní základy; neplatné položky zahodí. */
export function restoreBases(raw: string | null): CatalogBasis[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitizeBasis).filter((b): b is CatalogBasis => b !== null);
  } catch {
    return [];
  }
}
