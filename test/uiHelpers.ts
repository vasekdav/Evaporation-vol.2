/**
 * Každý textový uzel s číslicí ve výsledcích musí ležet v <Qty> (číslo + jednotka + původ),
 * ve vzorci, nebo ve vysvětlujícím textu (zprávy kontrol, poznámky).
 */
export function untaggedNumbers(root: HTMLElement): string[] {
  const bad: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? '';
    if (!/\d/.test(text)) continue;
    const el = n.parentElement!;
    // nadpisy jsou názvy sekcí (např. „Kontroly K1–K8“), ne hodnoty
    // grafy a jejich tabulky: jednotka je v názvu osy / záhlaví sloupce, původ ve štítku titulku
    if (el.closest('[data-formula], [data-narrative], [data-chart], h1, h2, h3')) continue;
    const q = el.closest('[data-qty]');
    if (q && q.getAttribute('data-unit') && q.getAttribute('data-source') && q.querySelector('.src')) continue;
    bad.push(text);
  }
  return bad;
}

