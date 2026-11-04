# Changelog

Verze se zobrazuje v reportu (fáze 4).

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
