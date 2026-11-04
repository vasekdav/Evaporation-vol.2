/** Formátování čísel pro texty jádra (CZ: desetinná čárka, pevná mezera jako oddělovač tisíců). */
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
  // U+2212 pro záporná čísla je v cs-CZ výchozí; sjednotíme pro čitelnost v textech.
  return nf.format(x);
}
