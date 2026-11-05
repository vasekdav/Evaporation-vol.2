/**
 * Formátování čísel pro texty a UI. CZ: desetinná čárka, pevná mezera jako oddělovač tisíců;
 * EN: desetinná tečka, čárka jako oddělovač tisíců. V obou typografické minus U+2212.
 */
import { getLang } from './i18n';

const cache = new Map<string, Intl.NumberFormat>();

export function fmt(x: number, decimals = 2): string {
  const locale = getLang() === 'en' ? 'en-GB' : 'cs-CZ';
  const key = `${locale}|${decimals}`;
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(key, nf);
  }
  return nf.format(x).replace(/-/g, '−');
}
