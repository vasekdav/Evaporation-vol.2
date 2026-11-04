# Odpařovač – výpočet a návrh atmosférických odpařovačů kryogenních kapalin

Inženýrský nástroj pro O₂ a N₂ (fáze 1), později Ar. Přesně počítá tepelnou potřebu
z referenčních stavových rovnic, odhaduje **ideální dolní mez** velikosti vůči
katalogovému základu výrobce a kontroluje bezpečnost (křehký lom, TSL podle AIGA 027).

> **Aplikace není náhradou výběru a garance výrobce.** Velikost odpařovače vždy
> potvrzuje výrobce přepočtem na konkrétní lokalitu.

Každé číslo je jednoho ze tří druhů a nikdy se nesměšují:
**VÝPOČET** (fyzika) · **PRAXE** (pravidlo nebo odhad z praxe) · **ÚDAJ VÝROBCE**.

## Stav

| Fáze | Obsah | Stav |
|---|---|---|
| 1 | Výpočetní jádro a testy pro O₂ a N₂ | **hotovo** |
| 2 | UI výpočtu a kontroly | **hotovo** |
| 3 | Velikost, koncept, citlivost (+ stránka Ověření, editovatelné katalogové základy) | **hotovo** |
| 4 | Poptávka, export (PDF, Excel, JSON, odkaz), výuková část, postup návrhu, rovnice, zdroje | **hotovo** |
| 5 | Argon (případně CO₂) | – |

## Spuštění

```bash
npm install
npm run dev         # vývojový server, http://localhost:5173
npm test            # referenční případy kap. 9, přesnost tabulek, UI testy
npm run typecheck
npm run build       # statický web do dist/ (relativní cesty, bez backendu)
npm run preview     # náhled buildu
```

Složku `dist/` lze nasadit na libovolný statický web nebo intranet.

Pro sdílený disk nebo tablet bez serveru:

```bash
npm run build:single   # dist-single/index.html – celá aplikace v jednom souboru (~3,3 MB), funguje přes file://
```

Regenerace tabulek vlastností (jen při změně mřížky nebo látky):

```bash
pip install -r tools/requirements.txt   # CoolProp==7.2.0 (zafixováno)
npm run gen:tables                       # zapíše src/data/properties/*.json a test/fixtures/*
npm run gen:check                        # CI: ověří, že uložená data odpovídají CoolProp
```

## Architektura

```
tools/gen_tables.py        generátor tabulek z CoolProp 7.2.0 (+ validační body)
src/core/
  units.ts                 jednotky a převody (p_bar_a, T_C, T_K, Nm³/Sm³/scf, barg/bara)
  properties/              PropertyProvider (rozhraní) + TableProvider (tabulky, interpolace)
  fluids.ts                politika látek (výchozí T kapaliny, sloupec katalogu LOX/LIN)
  duty.ts                  ṁ, Q, q₁/q₂/q₃, zóny I/II, střední c_p, spotřeba, dohřev
  sizing.ts                ΔT, LMTD, UA_potř, UA₁, N_eq, tepelná náročnost, nejmenší kapacita větve
  psychro.ts               Magnus, absolutní vlhkost, latentní potenciál (vysvětlující model)
  catalog.ts               katalogové základy a modely (ÚDAJ VÝROBCE, ilustrativní)
  checks.ts                kontroly K1–K8, semafor, věta o stavu výsledku
  concept.ts               doporučení konceptu (kap. 6.3), pravidla návrhu (kap. 6.2) – PRAXE
  sensitivity.ts           Q a N_eq vs. T_out a vs. T_okolí, absolutní vlhkost vs. T
  verification.ts          referenční případy kap. 9 pro stránku Ověření i testy, příklad LIN/LOX
  inquiry.ts               generátor poptávky (předvyplnění, „proč“, kontrola shody se vstupy)
  restore.ts               bezpečné obnovení vstupů z uložených dat
src/report/
  model.ts                 model reportu a poptávky (jediný zdroj pro PDF i Excel)
  pdf.ts                   PDF (pdfmake, Roboto s českou diakritikou; načítá se až při exportu)
  xlsx.ts                  Excel (ExcelJS; čísla jako čísla; načítá se až při exportu)
  caseFile.ts              uložení případu (JSON) a sdílitelný odkaz (?case=…)
  input.ts                 vstupní model (kap. 4) a výchozí hodnoty
  evaluate.ts              orchestrace jednoho případu (čistá funkce)
src/ui/
  App.tsx                  rozvržení: vstupy vlevo (na úzké obrazovce nahoře + přilepený souhrn)
  texts.ts                 texty CZ, nápovědy „proč na tom záleží“ (připraveno pro CZ/EN)
  state.ts                 stav vstupů, localStorage jen pro pohodlí (ošetřené chyby)
  components/Qty.tsx       jediný způsob zobrazení čísla: hodnota + jednotka + štítek původu
  components/fields.tsx    pole s CZ desetinnou čárkou, přepínače, rozbalovací nápověda
  components/InputPanel.tsx  vstupy kap. 4
  components/results.tsx   stav výsledku, karta výsledku, semafor K1–K8
  components/StepByStep.tsx  postup výpočtu s rovnicemi a mezihodnotami
  components/SizingPanel.tsx posouzení velikosti – ideální dolní mez, ilustrace z katalogu
  components/ConceptPanel.tsx doporučení konceptu s odůvodněním, varianty (a)/(b)/(c)
  components/SensitivityPanel.tsx + LineChart.tsx  citlivostní grafy (SVG, hover/klávesnice, tabulka)
  components/BasisEditor.tsx vlastní katalogové základy (kopie / nový / smazat, localStorage)
  components/VerificationPage.tsx stránka Ověření
  components/ExportBar.tsx   Report PDF, Poptávka PDF, Excel, Uložit / Načíst případ, Kopírovat odkaz
  pages/InquiryPage.tsx    poptávka pro výrobce
  pages/LearnPage.tsx      „Proč ne kW“, výpočet × praxe × realita, interaktivní model
  pages/InfoPages.tsx      postup návrhu v 10 krocích, rovnice a předpoklady, zdroje
src/data/
  properties/{O2,N2}.json  tabulky vlastností (generované)
  catalog/*.json           katalogové základy a modely (editovatelné)
test/
  reference.test.ts        akceptační případy kap. 9 (hodnoty přepsané ze zadání)
  accuracy.test.ts         3000 náhodných bodů / látku proti přímému CoolProp
  core.test.ts             jednotkové testy větví logiky
  ui.test.tsx              UI: čísla shodná s jádrem, změna látky, kontroly, „žádné číslo bez jednotky a původu“
```

### Původ čísel v UI

Každé číslo ve výsledcích se zobrazuje komponentou `Qty` se štítkem původu:
**VÝP** VÝPOČET (fyzika) · **PRX** PRAXE · **VÝR** ÚDAJ VÝROBCE · **VST** VSTUP (zadáno uživatelem,
např. v dosazení do rovnic). Test `ui.test.tsx` prochází všechny textové uzly výsledků a selže,
pokud najde číslo mimo `Qty`, vzorec nebo vysvětlující text (zprávy kontrol, poznámky).

Výpočetní jádro je čisté TypeScript bez závislosti na UI. Mimo rozsah dat se nikdy
neextrapoluje: provider vyhodí `PropertyRangeError` a kontroly výsledek zablokují s důvodem.

## Vlastnosti látek

- Stavové rovnice: O₂ Schmidt & Wagner (1985), N₂ Span et al. (2000), přes CoolProp 7.2.0.
- Referenční stav entalpie: nasycená kapalina při 1,01325 bar má h = 0.
- Tabulky:
  - **nasycení podle tlaku** – základ 0,5 bar do 20 bar a a 1 bar nad 20 bar a, zhuštěno
    na 0,1 bar pro 1–3 bar a, na 0,25 bar pro 3–8 bar a a u N₂ na 0,25 / 0,1 bar od 24 / 28 bar a;
  - **plyn h(p, T)** −60 až +40 °C po 5 K, bilineárně;
  - **kapalina h_l(T, Δp), ρ_l(T, Δp)** s Δp = p − p_sat(T) ≥ 0, bilineárně. Je to obecná forma
    korekce h_l,sat(T) + (∂h/∂p)_T·Δp; lineární korekce u N₂ blízko kritického bodu
    nedosahuje 0,1 %.
- Doložená přesnost (3000 náhodných bodů na látku v celém rozsahu, `test/accuracy.test.ts`):

  | | Q | Q_I | Q_II | T_sat | ρ_in |
  |---|---|---|---|---|---|
  | O₂ | 0,007 % | 0,021 % | 0,010 % | 0,008 K | 0,008 % |
  | N₂ | 0,006 % | 0,019 % | 0,010 % | 0,007 K | 0,012 % |

  Požadavek: ≤ 0,1 % výkonu, ±0,05 K.

## Poznámky k zadání zjištěné při ověřování

- Katalogový tlak Chart SuperGap EU „15 bar“ je **předpokládán jako přetlak** (16,01325 bar a),
  protože jen s ním vychází UA₁ = 1,5229 (O₂) a 1,4503 (N₂) W/K na Nm³/h ze zadání. V katalogu
  zatím **neověřeno** (`pressureVerified: false` v `src/data/catalog/bases.json`); aplikace to
  vypisuje u posouzení velikosti. Při 15 bar a by UA₁ bylo nižší o 0,10 % (O₂) / 0,16 % (N₂),
  N_eq o totéž vyšší. Po ověření v katalogu stačí změnit příznak (případně druh tlaku).
- Psychrometrie 20 °C / 75 %: předepsaný Magnusův vzorec dává **10,93 g/kg** (zadání uvádí 10,95;
  rozdíl je v konstantách vzorce). Rozhodnutí: platí 10,93, implementován je předepsaný vzorec.
- Poměr LIN/LOX v katalogu Chart: zadání uvádí ≈ 1,085–1,087, z tabulky modelů v kap. 7 vychází
  1,084–1,091 (SG430HF 1200/1100 = 1,091). Na závěru to nic nemění – fyzika (konstantní U) dává 1,050.
- Tlaková ztráta 0,5 bar by zvýšila Q o +0,051 % (O₂) / +0,046 % (N₂) – potvrzuje kap. 5.2.

## Zdroje

Viz kap. 12 zadání; stránka Zdroje bude součástí UI (fáze 4).
