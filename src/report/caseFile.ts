/**
 * Uložení případu jako JSON a sdílitelný odkaz (URL parametr `case`).
 * Načtená data se vždy validují a slučují s výchozími hodnotami.
 */
import type { CatalogBasis } from '../core/catalog';
import type { DesignInput } from '../core/input';
import type { InquiryOverrides } from '../core/inquiry';
import { sanitizeBasis, sanitizeInput } from '../core/restore';
import { tr } from '../core/i18n';

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
    return { ok: false, reason: tr('Soubor není platný JSON.', 'The file is not valid JSON.') };
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: tr('Soubor neobsahuje případ.', 'The file does not contain a case.') };
  const c = data as Partial<CaseFile>;
  if (c.app !== CASE_APP) return { ok: false, reason: tr('Soubor není případ této aplikace.', 'The file is not a case of this application.') };
  if (typeof c.schema !== 'number' || c.schema > CASE_SCHEMA)
    return { ok: false, reason: tr(`Nepodporovaná verze souboru (${String(c.schema)}).`, `Unsupported file version (${String(c.schema)}).`) };
  const input = sanitizeInput(c.input);
  const customBasis = c.customBasis ? sanitizeBasis(c.customBasis) : null;
  const inquiry: Record<string, string> = {};
  if (c.inquiry && typeof c.inquiry === 'object' && !Array.isArray(c.inquiry))
    for (const [k, v] of Object.entries(c.inquiry))
      if (typeof v === 'string' && k.length <= 100 && k !== '__proto__') inquiry[k] = v.slice(0, 5000);
  return { ok: true, input, customBasis, inquiry };
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
    return { ok: false, reason: tr('Odkaz je poškozený.', 'The link is corrupted.') };
  }
}

/**
 * Odkaz na aktuální stránku s případem ve fragmentu `#case=…`. Fragment se neposílá
 * na server, takže data případu nekončí v přístupových lozích hostingu.
 */
export function shareUrl(c: CaseFile, base: string): string {
  const u = new URL(base);
  u.searchParams.delete(CASE_PARAM);
  u.hash = `${CASE_PARAM}=${caseToParam(c)}`;
  return u.toString();
}

/**
 * Přečte případ z adresy (`#case=…`, starší odkazy `?case=…`) a parametr z adresy odstraní.
 * Volá se jednou před vykreslením aplikace.
 */
export function takeCaseFromUrl(): ParsedCase | null {
  try {
    const u = new URL(window.location.href);
    const fromHash = u.hash.startsWith(`#${CASE_PARAM}=`) ? u.hash.slice(CASE_PARAM.length + 2) : null;
    const param = fromHash ?? u.searchParams.get(CASE_PARAM);
    if (!param) return null;
    u.searchParams.delete(CASE_PARAM);
    if (fromHash !== null) u.hash = '';
    window.history.replaceState(null, '', u.toString());
    return caseFromParam(param);
  } catch {
    return null;
  }
}
