/**
 * Formátování čísel pro texty a UI (CZ: desetinná čárka, pevná mezera jako oddělovač tisíců,
 * typografické minus U+2212). Intl v Chromiu vrací pro cs-CZ spojovník, proto se sjednocuje.
 */
const cache = new Map<number, Intl.NumberFormat>();

export function fmt(x: number, decimals = 2): string {
  let nf = cache.get(decimals);
  if (!nf) {
    nf = new Intl.NumberFormat('cs-CZ', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    cache.set(decimals, nf);
  }
  return nf.format(x).replace(/-/g, '−');
}
