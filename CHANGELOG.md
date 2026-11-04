# Changelog

Verze se zobrazuje v reportu (fáze 4).

## 0.5.0 – fáze 5: argon

- Argon (Tegeler et al. 1999): tabulky z CoolProp 7.2.0, rozsah 1–40 bar a, kapalina od −189 °C, výchozí −186 °C,
  sloupec katalogu LAR; přesnost proti CoolProp ve 3000 bodech (výkon ≤ 0,033 %).
- Referenční případy Ar vygenerované přímo z CoolProp stejnou sadou jako kap. 9.1/9.2 (vlastnosti, 11 případů Q,
  UA₁, N_eq, dohřev, kontroly K2/K5) – v testech i na stránce Ověření (celkem 98 řádků).
- Poptávka a postup návrhu pro Ar (skupina PED 2, riziko udušení, argon těžší než vzduch).
- Bez sloupce LAR v katalogu se modely neukazují a nic se nepřepočítává z LOX/LIN.

## 0.4.0 – fáze 4: poptávka, export, výuková část

- Generátor poptávky: 11 položek (identifikace, zdroj kapaliny, PS/TS a PED, připojení, tlaková ztráta,
  garanční podmínky, ochrany, přepínací armatury, zatížení, čistota – kyslíková jen pro O₂, dokumenty),
  předvyplněno ze vstupů, ke každé položce „proč to výrobce potřebuje“, kontrola shody se vstupy výpočtu
  a seznam polí k doplnění; úpravy se pamatují.
- Export: Report PDF (vstupy, výsledky, mezihodnoty, velikost, koncept, kontroly, upozornění, poptávka,
  verze aplikace, datum), Poptávka PDF, Excel (Info, Vstupy, Výsledky, Kontroly, Koncept, Poptávka; čísla
  jako čísla). Knihovny se načítají až při exportu.
- Uložení / načtení případu jako JSON (s validací) a sdílitelný odkaz `?case=…`.
- Stránky: Postup návrhu v 10 krocích (+ 5b analýza rizik; krok 8 podle látky), Proč ne kW
  (výpočet × praxe × realita, interaktivní model), Rovnice a předpoklady, Zdroje.
- Jednosouborový build `npm run build:single` pro otevření ze sdíleného disku (file://).
- Testy exportu (text PDF ověřen přes pdftotext, Excel načten zpět), poptávky, případu a UI fáze 4.

## 0.3.0 – fáze 3: velikost, koncept, citlivost

- Posouzení velikosti jako vizuálně odlišená „ideální dolní mez“: T_des, ΔT, LMTD, UA_I/UA_II/UA_potř,
  katalogové podmínky (ÚDAJ VÝROBCE), UA₁, N_eq, k, tepelná náročnost, nejmenší kapacita větve
  („dolní hranice pro poptávku – NE doporučený model“), orientační rezerva praxe 1,2–1,5× s podmínkou
  přiblížení ≈ 10 K, povinná upozornění.
- Ilustrace modelů z katalogu (jen pod nadpisem „Ilustrace z katalogu – výběr a garance výrobce“),
  sloupec podle látky (LOX/LIN).
- Doporučení konceptu (kap. 6.3): jedna větev / přepínané větve / dohřev / nucený tah / vodní lázeň / N+1
  s rolí (doporučeno / doplněk / zvážit), odůvodněním, výhodami, riziky a co hlídat; varianty (a)/(b)/(c);
  pravidla návrhu kap. 6.2.
- Citlivost: Q a N_eq vs. výstupní teplota a vs. teplota okolí (−20 až +20 °C), absolutní vlhkost vs.
  teplota; SVG grafy s křížovým kurzorem, ovládání klávesnicí a tabulkovým zobrazením.
- Katalogové základy editovatelné: vlastní kopie vestavěného základu, nový základ, smazání; příznak
  „tlak ověřen“; ukládání v prohlížeči.
- Stránka Ověření: 61 referenčních případů kap. 9 s aktuální odchylkou a tolerancí, poučný příklad LIN/LOX.
- Testy: koncept, citlivost, ověření, UI fáze 3 (celkem 118).

## 0.2.0 – fáze 2: UI výpočtu a kontroly

- React + TypeScript + Vite, jedna stránka, bez backendu, relativní cesty pro statické nasazení.
- Vstupy podle kap. 4 ve skupinách (potřeba, proces, klima, bezpečnost, provoz, katalogový základ),
  každé pole s nápovědou „proč na tom záleží“ (rozbalovací, funguje dotykem).
- Přepínače přetlak/absolutní a jednotek průtoku (Nm³/h, Sm³/h, scfh) převádějí hodnotu.
- Desetinná čárka ve vstupech i výstupech; neplatný zápis označí pole a K1.
- Karta výsledku: Q, zóny I/II, Q pro nasycenou kapalinu, ṁ, absolutní tlak, T_sat, spotřeba za den, dohřev.
- Semafor K1–K8 s vysvětlením a odkazem na normu; stav výsledku jednou větou.
- Postup výpočtu krok za krokem s rovnicemi, dosazením a mezihodnotami.
- Štítek původu u každého čísla (VÝPOČET / PRAXE / ÚDAJ VÝROBCE / VSTUP) a legenda.
- Rozvržení pro notebook i tablet; na úzké obrazovce přilepený souhrn výsledku.
- Poslední vstupy v localStorage (jen pro pohodlí, s ošetřením chyb).
- UI testy (jsdom); CI navíc ověřuje build.

## 0.1.0 – fáze 1: výpočetní jádro

- Generátor tabulek z CoolProp 7.2.0 pro O₂ a N₂, včetně validačních bodů.
- `PropertyProvider` nad tabulkami: nasycení, plyn, stlačená kapalina; bez tiché extrapolace.
- Výkon, rozklad q₁/q₂/q₃, zóny I/II, střední c_p, spotřeba, dohřev.
- Ideální dolní mez velikosti (UA, N_eq, tepelná náročnost, nejmenší kapacita větve) s povinnými upozorněními.
- Psychrometrie (Magnus nad vodou / ledem).
- Kontroly K1–K8 a stav výsledku.
- Katalogové základy (Chart SuperGap EU, Tekoma/Cryonorm) a modely Chart SuperGap EU – ilustrativní, editovatelné.
- Testy: referenční případy kap. 9 pro O₂ i N₂, přesnost tabulek v 3000 bodech na látku, větve kontrol.
- CI: typová kontrola, testy a ověření, že tabulky odpovídají CoolProp 7.2.0.
