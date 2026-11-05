/** Postup návrhu v 10 krocích (kap. 6.4): co udělat, vstupy, výstupy, typická chyba. */
import type { FluidId } from '../../core/properties/types';
import { getLang } from '../../core/i18n';

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
  return getLang() === 'cs' ? guideStepsCs(fluid) : guideStepsEn(fluid);
}

function guideStepsCs(fluid: FluidId): GuideStep[] {
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
      link: { page: 'vypocet', anchor: 'grp-need', label: 'Vstupy: potřeba' },
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
      link: { page: 'vypocet', anchor: 'grp-process', label: 'Vstupy: proces a bezpečnost' },
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
      link: { page: 'vypocet', anchor: 'grp-climate', label: 'Vstupy: klima lokality' },
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

function guideStepsEn(fluid: FluidId): GuideStep[] {
  const safety8 =
    fluid === 'O2'
      ? [
          'Oxygen cleanliness: cleaning and materials for oxygen service (EIGA Doc 33 / EN 12300), no grease or contaminants, cleaning certificate.',
          'Surroundings free of combustibles and grease; oxygen enrichment after a leak increases the flammability of clothing and materials.',
          'No asphalt or combustible base under liquid oxygen equipment (use concrete).',
          'Automatic changeover valves in oxygen: risk of ignition by adiabatic compression – materials and slow opening; pipeline velocities per EIGA Doc 13.',
          'For indoor installation, O₂ enrichment detection.',
        ]
      : fluid === 'N2'
        ? [
            'Asphyxiation risk from a nitrogen leak in a confined space: outdoor location or well-ventilated room, O₂ detection depending on the installation site.',
            'Cold nitrogen is heavier than air and collects in pits and trenches; warning signs and a confined-space entry procedure.',
          ]
        : [
            'Asphyxiation risk from an argon leak in a confined space: outdoor location or well-ventilated room, O₂ detection depending on the installation site.',
            'Argon is heavier than air – it accumulates in pits, trenches, shafts and basements; place O₂ detection low.',
            'Warning signs and a confined-space entry procedure.',
          ];
  return [
    {
      n: '1',
      title: 'Define the demand',
      todo: ['Determine the peak flow (not the average) and the average flow.', 'Define the operating profile: h/day, 24/7, seasonality, future expansion.'],
      inputs: 'Consumers, consumption records, production plan.',
      outputs: 'Peak and average flow in Nm³/h, operating profile.',
      mistake: 'Sizing for the average or forgetting simultaneous peaks.',
      link: { page: 'vypocet', anchor: 'grp-need', label: 'Inputs: demand' },
    },
    {
      n: '2',
      title: 'Process conditions',
      todo: [
        'Operating pressure (distinguish barg and bar a), liquid state from the source (subcooling).',
        'Required outlet temperature, minimum design temperature of downstream piping, TSL.',
      ],
      inputs: 'Tank and piping data, materials, P&ID.',
      outputs: 'p, T_in, T_out, piping limit, TSL and margin.',
      mistake: 'Confusing gauge and absolute pressure; T_out close to ambient without considering size.',
      link: { page: 'vypocet', anchor: 'grp-process', label: 'Inputs: process and safety' },
    },
    {
      n: '3',
      title: 'Site climate',
      todo: [
        'Minimum site temperature (not the ČSN heating design temperature), winter humidity, length of the frost period.',
        'Wind and location (cold air lingers around buildings and in pits).',
      ],
      inputs: 'Climate data, location on the site.',
      outputs: 'T_min of the site, RH, frost weeks.',
      mistake: 'Using the heating design temperature as the absolute minimum.',
      link: { page: 'vypocet', anchor: 'grp-climate', label: 'Inputs: site climate' },
    },
    {
      n: '4',
      title: 'Calculate the duty',
      todo: ['Q, zones I/II, liquid consumption, trim heating.', 'Check K1–K8 (data range, brittle fracture, TSL).'],
      inputs: 'Steps 1–3.',
      outputs: 'Q [kW], Q_I/Q_II, ṁ, check status.',
      mistake: 'Taking kW as the vaporizer size – an ambient vaporizer “has no duty rating”.',
      link: { page: 'vypocet', anchor: 'res-h', label: 'Result' },
    },
    {
      n: '5',
      title: 'Choose the concept',
      todo: [
        'Single branch / switched branches / trim heater / forced draft / water bath / N+1 according to profile, climate and approach.',
        'Assess the ideal lower size bound against the catalogue basis.',
      ],
      inputs: 'Duty, profile, T_des, approach, availability.',
      outputs: 'Concept with reasoning, minimum branch capacity (lower bound).',
      mistake: 'Choosing a model by catalogue Nm³/h without recalculating for the site.',
      link: { page: 'vypocet', anchor: 'concept-h', label: 'Concept recommendation' },
    },
    {
      n: '5b',
      title: 'Risk analysis',
      todo: [
        'HAZOP / LOPA; low temperature protection system (LTPS) per AIGA 027 tables 6.1–6.3 (verify in the current revision; European equivalent EIGA Doc 133).',
        'Required SIL for the TSL; management of change (MOC) when the consumption or source changes.',
      ],
      inputs: 'Concept, P&ID, operating scenarios.',
      outputs: 'Protection requirements (SIL), decision between variants.',
      mistake: 'A TSL without defined reliability; a change of consumption without MOC.',
    },
    {
      n: '6',
      title: 'Enquiry to the manufacturer',
      todo: ['Fill in the enquiry: guarantee conditions, PS/TS, protections, changeover, loads, cleanliness, documents.'],
      inputs: 'Steps 1–5b.',
      outputs: 'Enquiry (PDF / Excel).',
      mistake: 'Asking for “a 1000 Nm³/h vaporizer” without guarantee conditions.',
      link: { page: 'poptavka', label: 'Enquiry generator' },
    },
    {
      n: '7',
      title: 'Evaluate the offers',
      todo: [
        'Compare capacities recalculated for the site and the T_out guarantee at the end of the cycle, not catalogue Nm³/h.',
        'Scope of protections (sensor, fail-close valve, SIL), PED, documentation.',
      ],
      inputs: 'Manufacturer offers.',
      outputs: 'Selected offer with a guarantee.',
      mistake: 'Comparing models of different manufacturers by catalogue Nm³/h – manufacturers use different catalogue bases.',
    },
    {
      n: '8',
      title: 'Safety and installation',
      todo: [
        ...safety8,
        'Foundation and drainage of melting ice, clearances, fog and ice zone (visibility, slipperiness).',
        'PED and national pressure equipment rules, structural design and anchoring (ice, wind, snow).',
        'Relief valves on sections where liquid can be trapped (isolated branch, downstream of the TSL valve, trim heater).',
        'Falling ice from the unit and piping – protective zone, access only outside the zone.',
      ],
      inputs: 'Layout, manufacturer offer.',
      outputs: 'Location and installation design.',
      mistake: 'Melting ice draining onto a roadway; fog over a road.',
    },
    {
      n: '9',
      title: 'Commissioning',
      todo: [
        'SAT, functional test of the protections (TSL, fail-close valve), PSSR.',
        'Balancing of parallel branches (AIGA 027 cl. 8.10).',
        'Operator training; emergency procedures (leak, cold burns, PPE); defrosting procedure with shutdown and isolation (LOTO).',
      ],
      inputs: 'Documentation, test procedures.',
      outputs: 'Test records, permission to operate.',
      mistake: 'A protection not tested over the whole loop (sensor → logic → valve).',
    },
    {
      n: '10',
      title: 'Operation and feedback',
      todo: [
        'Log of the outlet temperature at the end of the cycle; KPIs: TSL trips per year, margin above TSL, failed changeovers.',
        'Icing inspections per AIGA 030.',
        'Periodic tests of the whole TSL loop (sensor → logic → valve) at the interval from the risk analysis; bypass records.',
      ],
      inputs: 'Operating data.',
      outputs: 'Margin trend, basis for adjustments.',
      mistake: 'Lowering the TSL when the vaporizer trips often – the TSL is never lowered.',
    },
  ];
}
