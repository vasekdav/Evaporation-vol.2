/** Postup návrhu v 10 krocích (kap. 6.4): co udělat, vstupy, výstupy, typická chyba. */
import type { FluidId } from '../../core/properties/types';

export type PageId = 'vypocet' | 'poptavka' | 'postup' | 'proc-ne-kw' | 'rovnice' | 'overeni' | 'zdroje';

export interface GuideStep {
  n: string;
  title: string;
  todo: string[];
  inputs: string;
  outputs: string;
  mistake: string;
  link?: { page: PageId; anchor?: string; label: string };
}

export function guideSteps(fluid: FluidId): GuideStep[] {
  const safety8 =
    fluid === 'O2'
      ? [
          'Kyslíková čistota: čištění a materiály pro kyslíkovou službu (EIGA Doc 33 / EN 12300), žádné mazivo a nečistoty, certifikát čištění.',
          'Okolí bez hořlavin a mastnoty; obohacení atmosféry kyslíkem při úniku zvyšuje hořlavost oděvů a materiálů.',
          'Pod zařízením s kapalným kyslíkem žádný asfalt ani hořlavý podklad (beton).',
          'Automatické přepínací armatury v kyslíku: riziko zapálení adiabatickou kompresí – materiály a pomalé otevírání; rychlosti v potrubí dle EIGA Doc 13.',
          'Při vnitřní instalaci detekce obohacení O₂.',
        ]
      : fluid === 'N2'
        ? [
            'Riziko udušení při úniku dusíku v uzavřeném prostoru: umístění venku nebo dobře větraný prostor, detekce O₂ podle místa instalace.',
            'Studený dusík je těžší než vzduch a drží se v jámách a kanálech; výstražné značení a postup pro vstup do uzavřených prostor.',
          ]
        : [
            'Riziko udušení při úniku argonu v uzavřeném prostoru: umístění venku nebo dobře větraný prostor, detekce O₂ podle místa instalace.',
            'Argon je těžší než vzduch – hromadí se v jámách, kanálech, šachtách a sklepech; detekci O₂ umísti nízko.',
            'Výstražné značení a postup pro vstup do uzavřených prostor.',
          ];
  return [
    {
      n: '1',
      title: 'Definuj potřebu',
      todo: ['Zjisti špičkový průtok (ne průměr) a průměrný průtok.', 'Urči profil provozu: h/den, 24/7, sezónnost, budoucí rozšíření.'],
      inputs: 'Odběrová místa, záznamy spotřeby, plán výroby.',
      outputs: 'Špičkový a průměrný průtok v Nm³/h, profil provozu.',
      mistake: 'Dimenzovat na průměr nebo zapomenout na souběh špiček.',
      link: { page: 'vypocet', label: 'Vstupy: potřeba' },
    },
    {
      n: '2',
      title: 'Procesní podmínky',
      todo: [
        'Provozní tlak (rozliš barg a bar a), stav kapaliny ze zdroje (podchlazení).',
        'Požadovaná výstupní teplota, min. návrhová teplota navazujícího potrubí, TSL.',
      ],
      inputs: 'Data nádrže a potrubí, materiály, P&ID.',
      outputs: 'p, T_in, T_out, mez potrubí, TSL a rezerva.',
      mistake: 'Záměna přetlaku a absolutního tlaku; T_out blízko okolí bez úvahy o velikosti.',
      link: { page: 'vypocet', label: 'Vstupy: proces a bezpečnost' },
    },
    {
      n: '3',
      title: 'Klima lokality',
      todo: [
        'Minimální teplota lokality (ne výpočtová teplota ČSN pro vytápění), vlhkost v zimě, délka mrazového období.',
        'Vítr a umístění (studený vzduch se drží u budov a v jámách).',
      ],
      inputs: 'Klimatická data, umístění na pozemku.',
      outputs: 'T_min lokality, RH, týdny mrazu.',
      mistake: 'Použít výpočtovou teplotu pro vytápění jako absolutní minimum.',
    },
    {
      n: '4',
      title: 'Spočítej výkon',
      todo: ['Q, zóny I/II, spotřeba kapaliny, dohřev.', 'Zkontroluj K1–K8 (rozsah dat, křehký lom, TSL).'],
      inputs: 'Kroky 1–3.',
      outputs: 'Q [kW], Q_I/Q_II, ṁ, stav kontrol.',
      mistake: 'Brát kW jako velikost odpařovače – atmosférický odpařovač „nemá výkon“.',
      link: { page: 'vypocet', anchor: 'res-h', label: 'Výsledek' },
    },
    {
      n: '5',
      title: 'Zvol koncept',
      todo: [
        'Jedna větev / přepínané větve / dohřev / nucený tah / vodní lázeň / N+1 podle profilu, klimatu a přiblížení.',
        'Posuď ideální dolní mez velikosti vůči katalogovému základu.',
      ],
      inputs: 'Výkon, profil, T_des, přiblížení, dostupnost.',
      outputs: 'Koncept s odůvodněním, nejmenší kapacita větve (dolní hranice).',
      mistake: 'Vybrat model podle katalogových Nm³/h bez přepočtu na lokalitu.',
      link: { page: 'vypocet', anchor: 'concept-h', label: 'Doporučení konceptu' },
    },
    {
      n: '5b',
      title: 'Analýza rizik',
      todo: [
        'HAZOP / LOPA; systém ochrany proti nízké teplotě (LTPS) dle AIGA 027 tab. 6.1–6.3 (ověř v aktuální revizi; evropský ekvivalent EIGA Doc 133).',
        'Požadovaná úroveň SIL pro TSL; řízení změn (MOC) při změně odběru nebo zdroje.',
      ],
      inputs: 'Koncept, P&ID, provozní scénáře.',
      outputs: 'Požadavky na ochrany (SIL), rozhodnutí mezi variantami.',
      mistake: 'TSL bez stanovené spolehlivosti; změna odběru bez MOC.',
    },
    {
      n: '6',
      title: 'Poptávka u výrobce',
      todo: ['Vyplň poptávku: garanční podmínky, PS/TS, ochrany, přepínání, zatížení, čistota, dokumenty.'],
      inputs: 'Kroky 1–5b.',
      outputs: 'Poptávka (PDF / Excel).',
      mistake: 'Poptat „odpařovač 1000 Nm³/h“ bez garančních podmínek.',
      link: { page: 'poptavka', label: 'Generátor poptávky' },
    },
    {
      n: '7',
      title: 'Vyhodnoť nabídky',
      todo: [
        'Srovnávej přepočtené kapacity na lokalitu a garanci T_out na konci cyklu, ne katalogové Nm³/h.',
        'Rozsah ochran (čidlo, armatura fail-close, SIL), PED, dokumentace.',
      ],
      inputs: 'Nabídky výrobců.',
      outputs: 'Vybraná nabídka s garancí.',
      mistake: 'Srovnávat modely různých výrobců podle katalogových Nm³/h – výrobci mají různé katalogové základy.',
    },
    {
      n: '8',
      title: 'Bezpečnost a instalace',
      todo: [
        ...safety8,
        'Podklad a odvodnění tajícího ledu, odstupy, zóna mlhy a ledu (viditelnost, kluzkost).',
        'PED a vyhrazená tlaková zařízení, statika a kotvení (námraza, vítr, sníh).',
        'Pojistné ventily na úsecích, kde může zůstat uzavřená kapalina (odstavená větev, za armaturou TSL, dohřev).',
        'Padající led z jednotky a potrubí – ochranné pásmo, přístup jen mimo zónu.',
      ],
      inputs: 'Dispozice, nabídka výrobce.',
      outputs: 'Projekt umístění a instalace.',
      mistake: 'Odvodnění tajícího ledu na komunikaci; mlha nad cestou.',
    },
    {
      n: '9',
      title: 'Uvedení do provozu',
      todo: [
        'SAT, funkční zkouška ochran (TSL, fail-close armatura), PSSR.',
        'Vyvážení paralelních větví (AIGA 027 čl. 8.10).',
        'Školení obsluhy; havarijní postupy (únik, omrzliny, OOPP); postup odmrazování s odstavením a zajištěním (LOTO).',
      ],
      inputs: 'Dokumentace, postupy zkoušek.',
      outputs: 'Protokoly zkoušek, povolení provozu.',
      mistake: 'Ochrana neodzkoušená celou smyčkou (čidlo → logika → armatura).',
    },
    {
      n: '10',
      title: 'Provoz a zpětná vazba',
      todo: [
        'Log výstupní teploty na konci cyklu; KPI: vypnutí TSL za rok, rezerva nad TSL, selhání přepnutí.',
        'Kontroly námrazy dle AIGA 030.',
        'Periodické zkoušky celé smyčky TSL (čidlo → logika → armatura) v intervalu z analýzy rizik; evidence přemostění.',
      ],
      inputs: 'Provozní data.',
      outputs: 'Trend rezervy, podklad pro úpravy.',
      mistake: 'Snížit TSL, když odpařovač často vypíná – TSL se nikdy nesnižuje.',
    },
  ];
}
