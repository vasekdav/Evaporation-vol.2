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
| 2 | UI výpočtu a kontroly | – |
| 3 | Velikost, koncept, citlivost | – |
| 4 | Poptávka, export, výuková část | – |
| 5 | Argon (případně CO₂) | – |

## Spuštění

```bash
npm install
npm test            # referenční případy kap. 9 + přesnost tabulek proti CoolProp
npm run typecheck
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
  input.ts                 vstupní model (kap. 4) a výchozí hodnoty
  evaluate.ts              orchestrace jednoho případu (čistá funkce)
src/data/
  properties/{O2,N2}.json  tabulky vlastností (generované)
  catalog/*.json           katalogové základy a modely (editovatelné)
test/
  reference.test.ts        akceptační případy kap. 9 (hodnoty přepsané ze zadání)
  accuracy.test.ts         3000 náhodných bodů / látku proti přímému CoolProp
  core.test.ts             jednotkové testy větví logiky
```

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
- Tlaková ztráta 0,5 bar by zvýšila Q o +0,051 % (O₂) / +0,046 % (N₂) – potvrzuje kap. 5.2.

## Zdroje

Viz kap. 12 zadání; stránka Zdroje bude součástí UI (fáze 4).
