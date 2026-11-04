/**
 * Uložení případu jako JSON a sdílitelný odkaz (URL parametr `case`).
 * Načtená data se vždy validují a slučují s výchozími hodnotami.
 */
import type { CatalogBasis } from '../core/catalog';
import type { DesignInput } from '../core/input';
import type { InquiryOverrides } from '../core/inquiry';
import { restoreBases, restoreInput } from '../core/restore';

export const CASE_SCHEMA = 1;
export const CASE_APP = 'odparovac';

export interface CaseFile {
  app: typeof CASE_APP;
  schema: number;
  appVersion: string;
  savedIso: string;
  input: DesignInput;
  /** vlastní katalogový základ, pokud je vybraný */
  customBasis: CatalogBasis | null;
  inquiry: InquiryOverrides;
}

export function makeCase(
  input: DesignInput,
  customBases: readonly CatalogBasis[],
  inquiry: InquiryOverrides,
  appVersion: string,
  now: Date = new Date(),
): CaseFile {
  return {
    app: CASE_APP,
    schema: CASE_SCHEMA,
    appVersion,
    savedIso: now.toISOString(),
    input,
    customBasis: customBases.find((b) => b.id === input.catalogBasisId) ?? null,
    inquiry,
  };
}

export type ParsedCase = { ok: true; input: DesignInput; customBasis: CatalogBasis | null; inquiry: InquiryOverrides } | { ok: false; reason: string };

export function parseCase(text: string): ParsedCase {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Soubor není platný JSON.' };
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'Soubor neobsahuje případ.' };
  const c = data as Partial<CaseFile>;
  if (c.app !== CASE_APP) return { ok: false, reason: 'Soubor není případ této aplikace.' };
  if (typeof c.schema !== 'number' || c.schema > CASE_SCHEMA)
    return { ok: false, reason: `Nepodporovaná verze souboru (${String(c.schema)}).` };
  const input = restoreInput(JSON.stringify(c.input ?? null));
  const bases = restoreBases(JSON.stringify(c.customBasis ? [c.customBasis] : []));
  const inquiry: Record<string, string> = {};
  if (c.inquiry && typeof c.inquiry === 'object')
    for (const [k, v] of Object.entries(c.inquiry)) if (typeof v === 'string') inquiry[k] = v;
  return { ok: true, input, customBasis: bases[0] ?? null, inquiry };
}

// --- sdílitelný odkaz: base64url(UTF-8 JSON)
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export const CASE_PARAM = 'case';

export function caseToParam(c: CaseFile): string {
  return toBase64Url(JSON.stringify(c));
}

export function caseFromParam(param: string): ParsedCase {
  try {
    return parseCase(fromBase64Url(param));
  } catch {
    return { ok: false, reason: 'Odkaz je poškozený.' };
  }
}

/** Odkaz na aktuální stránku s případem v URL. */
export function shareUrl(c: CaseFile, base: string): string {
  const u = new URL(base);
  u.searchParams.set(CASE_PARAM, caseToParam(c));
  u.hash = '';
  return u.toString();
}
