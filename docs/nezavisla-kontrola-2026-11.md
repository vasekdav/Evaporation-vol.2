# Nezávislá odborná kontrola – listopad 2026 (verze 0.5.0 → 0.6.0)

Pět nezávislých posuzovatelů prošlo aplikaci, každý jen se zadáním a zdrojovým kódem:
fyzik/termodynamik, aplikační inženýr výrobce (praxe a realita), odborník na procesní
bezpečnost a provoz (AIGA/EIGA), UX/designér a softwarový inženýr/QA. Níže jsou jejich
nálezy a jak byly vyřešeny. Regresní testy k nálezům: `test/review.test.ts`,
`test/review-ui.test.tsx` a doplňky v ostatních testech.

## Shrnutí verdiktů

| Posuzovatel | Verdikt |
|---|---|
| Fyzik | Termodynamické jádro je správné a přesné (hustý sken 338 tisíc bodů: Q ≤ 0,012 %, T_sat ≤ 0,0084 K; reference kap. 9 i Ar nezávisle reprodukovány). Chyby v modelu velikosti a doprovodných tvrzeních. |
| Praxe | Fyzika poctivá a VÝPOČET / PRAXE / VÝROBCE oddělené, ale tři cesty k poddimenzované větvi (ilustrace od dolní meze, nejasné k, katalogových 8 h vs. 24/7). |
| Bezpečnost | Jádro a texty pečlivé, ale stav výsledku pouštěl nebezpečné kombinace jako „OK“ / „POZOR“. |
| UX | Čisté, okamžitý přepočet, disciplinované štítky; malé dotykové cíle a písmo, chyby jen daleko od polí, chybí tok S3. |
| Software | Jádro, testy, CI a nasazení v dobrém stavu; poškozená uložená data shodila aplikaci na bílou obrazovku. |

## Nálezy a vyřešení

Závažnost: K = kritické, V = vysoké, S = střední, N = nízké, I = info.

### Bezpečnost a provoz

| # | Záv. | Nález | Vyřešení |
|---|---|---|---|
| 1 | K | T_min ≤ mez potrubí a T_out nad mezí → jen POZOR, ačkoli výstup bude v mrazu nutně pod mezí | **opraveno** – K6 CHYBA „křehký lom“ (návrh nevyhovuje), se zadaným dohřevem POZOR + D2 |
| 2 | K | T_out bez dohřevu se nekontrolovala proti mezi potrubí | **opraveno** – nová kontrola D2 (úsek z nerezu, TSL za dohřevem, fail-close); koncept přidá dohřev |
| 3 | V | chybějící TSL a T_min → „Všechny kontroly OK“ | **opraveno** – D1 a stav „Neúplné – chybí: …“, NEZADÁNO v upozorněních reportu |
| 4 | V | velikost posouzena v létě bez T_min | **opraveno** – K7 upozorní, že pro zimu nemusí platit; stav „Neúplné“ |
| 5 | V | TSL = mez potrubí jako OK | **opraveno** – POZOR (přesnost čidla, doba zavření) |
| 6 | V | chybí ochrana uzavřených úseků (pojistné ventily) | **opraveno** – nová položka poptávky + krok 8 postupu |
| 7 | S | chybí požadavky na TSL a scénáře nad špičkou / studený start | **opraveno** – „Požadavky na TSL“ v poptávce; špičky jako pole k doplnění |
| 8 | S | rezerva nad TSL 0 K bez upozornění | **opraveno** – D3 INFO pod výchozími 5 K |
| 9 | S | „TSL doporučuje AIGA 027“ bagatelizuje | **opraveno** – „nutné posoudit podle AIGA 027; rozsah a SIL určí HAZOP / LOPA“ |
| 10 | S | LTPS přeloženo jako „nejnižší provozní teplota“ | **opraveno** – „systém ochrany proti nízké teplotě (LTPS)“ s výzvou ověřit v revizi normy |
| 11 | S | kyslík: asfalt, adiabatická komprese, EIGA Doc 13, detekce obohacení | **opraveno** – postup krok 8 a poptávka (armatury, podklad) |
| 12 | N | dusík: studený N₂ těžší než vzduch, značení, uzavřené prostory | **opraveno** |
| 13 | N | školení, havarijní postupy, LOTO, padající led, periodické zkoušky TSL | **opraveno** – kroky 8–10 |
| 14 | N | TS min pevně −196 °C | **opraveno** – MIN(−196 °C, T_kapaliny) |
| 15 | N | PS bez čerpadla; vágní legislativa | **opraveno** – uzavírací tlak čerpadla; zákon 250/2021 Sb., NV 191/2022 Sb. **k ověření** |
| 16 | N | report bez výhrady k rozsahu kontrol | **opraveno** – „nenahrazují HAZOP / LOPA, ověření SIL ani projekt“ |
| 17 | I | čísla článků AIGA 027 nelze ověřit bez normy; 9.2.2.1 i u „vypínal“ | **částečně** – odkaz 9.2.2.1 jen u TSL pod mezí; čísla článků je třeba ověřit v aktuální revizi (EIGA Doc 133) |

### Praxe a realita

| # | Záv. | Nález | Vyřešení |
|---|---|---|---|
| 1 | V | ilustrace začíná modelem těsně nad optimistickou mezí | **opraveno** – sloupec „pásmo praxe“, modely pod 1,2× průtoku zašedlé |
| 2 | V | k svádí k 1,2–1,5 (pravidlo je o průtoku) | **opraveno** – „k násobí N_eq“, upozornění „pod orientační rezervou praxe“ |
| 3 | V | katalogových 8 h vs. 24/7 se neporovnává | **opraveno** – doba provozu zobrazena, D4 POZOR v mrazu |
| 4 | V | garance bez délky cyklu | **opraveno** – pole délky cyklu, garanční věta, přepočtová tabulka |
| 5 | S | „OK“ bez T_min a TSL | **opraveno** (viz bezpečnost 3) |
| 6 | S | chybějící položky poptávky | **opraveno** – pojistné ventily, prostor/výška/odstupy, odmrazování, materiál výstupu, zkoušky, stav při dodání, špičky, čerpadlo |
| 7 | S | nejasné „2 větve + N+1“ | **opraveno** – „2 × 100 % přepínané větve (1 v provozu, 1 odtává)“, garance na jednu provozní větev |
| 8 | S | chybějící scénáře konceptu | **částečně** – mráz bez délky období, 24/7 v mrazu (dohřev / 3. větev / nucený tah), plánovaný dohřev; krátké špičky a vysokotlaké plnění zůstávají jako poznámka |
| 9 | N | tepelná náročnost < 1 bez komentáře | **opraveno** |
| 10 | N | zarůstání ledem kolem 0 až −5 °C | **opraveno** – výuková část |
| 11 | N | chybějící pole katalogového základu | **částečně** – doba provozu zobrazena; start z odmraženého stavu a vazba HP lined na tlak zůstávají v poznámce |
| 13 | I | Ar: N_eq vypsáno jako „LAR, katalogový základ“ | **opraveno** – „fyzikální ekvivalent“, katalog nemá LAR |

### Fyzika

| # | Záv. | Nález | Vyřešení |
|---|---|---|---|
| 1 | S | „LMTD … na bezpečné straně“ má pro N_eq opačné znaménko | **opraveno** – text podle integrace přes h(T): pod ~14 bar a N_eq o 1,5–4,5 % níž, při 30–40 bar o 6–14 % výš |
| 2 | S | Ar nad ~14 bar a: −189 °C je pod křivkou tání | **opraveno** – křivka tání z CoolProp v tabulkách, K5 ji kontroluje |
| 3 | S | objem spotřeby u nasycené kapaliny při vysokém tlaku zavádí | **opraveno** – i objem jako kapalina při 1,01325 bar |
| 4 | N | tlaková ztráta +0,05 % platí jen pro výchozí případ | **opraveno** – „+0,05 až +0,15 %“ |
| 5 | N | chybí meze věrohodnosti vstupů | **opraveno** – K1 (T_okolí, T_min, p_atm, průtok, k, T_skut), D3 (k < 1) |
| 6 | N | přiblížení → 0 bez varování | **opraveno** – D3 POZOR pod 3 K |
| 7 | N | RH vůči ledu vs. meteorologická konvence | **opraveno** – poznámka |
| 8 | I | předpoklad nasycené kapaliny u UA₁ | **opraveno** – uveden mezi předpoklady |
| 9 | I | „optimistický“ není vyčíslený | **opraveno** – formulováno jako převládající vliv |
| 10 | I | ρn pro Ar na stránce Rovnice | **opraveno** |

### UX

| # | Záv. | Nález | Vyřešení |
|---|---|---|---|
| 1 | V | dotykové cíle < 44 px | **opraveno** – ovládací prvky ≥ 44 px |
| 2 | V | chyby nejsou u pole | **opraveno** – nálezy kontrol u pole, aria-invalid / aria-describedby, hláška u nečitelného čísla |
| 3 | V | chybí tok S3 | **opraveno** – „Kontrola stávajícího odpařovače“ u posouzení velikosti (bez exportu do reportu) |
| 4 | S | stav neříká proč | **opraveno** – odkazy na kontroly ve stavovém pruhu i souhrnné liště |
| 5 | S | dlouhá stránka | **částečně** – obsah stránky (rychlé skoky); sekce se nesbalují |
| 6 | S | malé písmo štítků a grafů | **opraveno** |
| 7 | S | replaceState / fokus | **opraveno** – pushState, fokus po navigaci, kotvy kroků 1–3 |
| 8 | S | postup jen statický | **částečně** – stav kroků 1–6 a pořadí záložek; tlačítko „Další krok“ nedoplněno |
| 9 | S | nejednotné minus | **opraveno** – U+2212 ve formátovači |
| 10 | S | 1e9 Nm³/h bez varování | **opraveno** – K1 mez věrohodnosti |
| 11 | S | ořezané hodnoty v poptávce | **opraveno** – textarea, nápověda pod polem |
| 12 | N | ARIA přepínačů, aria-live, tooltip | **opraveno** – šipky, jedna zarážka, tooltip bez aria-live |
| 13 | N | PDF: sloupec stavu, osamocený nadpis | **opraveno**; ṁ a V̇ zůstávají jako „m“ a „Vn“ (písmo je nemá) |
| 14 | N | terminologie, jednotka „–“ | **opraveno** – K7 sjednoceno, „×“ u k a náročnosti |
| 15 | N | přetečení záložek, sloupec v Ověření | **opraveno** |

### Software

| # | Záv. | Nález | Vyřešení |
|---|---|---|---|
| 1 | V | bílá obrazovka u poškozených vnořených dat, chybí error boundary | **opraveno** – hloubková validace všech polí, ErrorBoundary s obnovou |
| 2 | S | vedlejší efekt v inicializátoru useState | **opraveno** – případ z odkazu se čte před vykreslením |
| 3 | S | K1 obejitelné klíči prototypu, boolean | **opraveno** |
| 4 | S | vlastní základ mimo tabulky zneplatní výkon | **opraveno** – chyba jen u posouzení velikosti; validace editoru |
| 5 | N | průtok bez horní meze | **opraveno** |
| 6 | N | neúplná validace vlastních základů | **opraveno** |
| 7 | N | data případu v query stringu (access log) | **opraveno** – fragment `#case=`; starší `?case=` stále funguje |
| 8 | N | chybí CSP a další hlavičky | **opraveno** – CSP bez `unsafe-eval` (export PDF i Excel ověřen), Permissions-Policy, COOP |
| 9 | N | testy obnovy dat jen na nejvyšší úrovni | **opraveno** – fuzz testy (jádro i UI) |
| 10 | I | hlavní chunk 767 kB | ponecháno – lazy-loading exportů funguje; dělení tabulek podle látky je možné později |
| 11 | I | npm audit: uuid přes exceljs | **opraveno** – override `uuid ^11.1.1`, audit 0 nálezů |
| 12 | I | licence třetích stran | **opraveno** – `third-party-licenses.txt` (generuje build), odkaz na stránce Zdroje |
| 13 | I | akce bez SHA, chybí `engines` | **částečně** – `engines: node >= 20.19`; připnutí akcí na SHA zbývá |

## Co zůstává otevřené

- Ověřit čísla článků AIGA 027 (a evropský ekvivalent EIGA Doc 133) a citace legislativy ČR
  v aktuálním znění.
- Ověřit katalogový tlak Chart (15 bar jako přetlak) a doplnit sloupec LAR z katalogu.
- Kontrola stávajícího odpařovače (S3) zatím není součástí PDF/Excel reportu.
- Sbalitelné sekce a průvodce „Další krok“; připnutí GitHub Actions na SHA.
