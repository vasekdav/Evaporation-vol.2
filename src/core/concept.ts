/**
 * Doporučení konceptu (kap. 6.3) – rozhodovací logika z pravidel praxe (kap. 6.2).
 * Vše je PRAXE: odůvodněné doporučení k analýze rizik, ne závazný výběr.
 *
 * Vstupy: profil provozu, délka mrazového období, T_des, přiblížení (T_des − T_out),
 * dostupnost, TSL a požadovaná rezerva. Prostor se zadává až v poptávce; zde jen „co hlídat“.
 */
import { fmt } from './format';
import { getLang, tr } from './i18n';
import type { Availability } from './input';

export type ConceptId = 'SINGLE' | 'SWITCHED' | 'ATM_HEATER' | 'FORCED_DRAFT' | 'WATER_BATH' | 'N_PLUS_1';

/** doporučeno = základ; doplněk = přidat k základu; zvážit = alternativa do analýzy rizik */
export type ConceptRole = 'doporučeno' | 'doplněk' | 'zvážit';

export interface ConceptInfo {
  id: ConceptId;
  name: string;
  pros: readonly string[];
  risks: readonly string[];
  watch: readonly string[];
}

const CONCEPTS_CS: Readonly<Record<ConceptId, ConceptInfo>> = {
  SINGLE: {
    id: 'SINGLE',
    name: 'Jedna větev',
    pros: ['Nejjednodušší a nejlevnější řešení', 'Žádné přepínací armatury'],
    risks: [
      'Pod 0 °C větev ani v odstávce neodtává – námraza se kumuluje přes celé mrazové období',
      'Bez zálohy: odmrazování nebo porucha = přerušení dodávky',
    ],
    watch: [
      'Výrobce musí dimenzovat i na mrazové období (garance při T_min na konci cyklu)',
      'Výstupní teplota na konci směny v mrazu (log T_out, KPI)',
    ],
  },
  SWITCHED: {
    id: 'SWITCHED',
    name: 'Dvě větve s automatickým přepínáním',
    pros: ['Odstavená větev odtává, zatímco druhá pracuje', 'Lze provozovat 24/7'],
    risks: [
      'Selhání přepnutí (armatura, řízení) vede k průniku studeného plynu',
      'Při mrazu pod 0 °C odstavená větev odtává jen pomalu',
    ],
    watch: [
      'Časovač 4–8 h + přepnutí při nízké výstupní teplotě; přepínání NENAHRAZUJE TSL',
      'Funkční zkoušky přepínání a KPI „selhání přepnutí“',
      'Vyvážení paralelních větví při uvedení do provozu (AIGA 027 čl. 8.10)',
    ],
  },
  ATM_HEATER: {
    id: 'ATM_HEATER',
    name: 'Atmosférický odpařovač + dohřev',
    pros: ['Dosáhne výstupní teploty i při mrazu', 'Menší atmosférická část než při malém přiblížení'],
    risks: ['Energie pro dohřev', 'Porucha dohřevu = studený plyn do potrubí'],
    watch: [
      'Úsek mezi odpařovačem a dohřevem z nerezu',
      'TSL až ZA dohřevem',
      'Porucha dohřevu musí uzavřít přívod (fail-close)',
    ],
  },
  FORCED_DRAFT: {
    id: 'FORCED_DRAFT',
    name: 'Nucený tah (ventilátory)',
    pros: ['Vyšší přestup tepla, menší zastavěná plocha', 'Studený vzduch se nedrží u jednotky'],
    risks: ['Závislost na elektrické energii', 'Hluk', 'Výstupní teplota stále omezena teplotou vzduchu'],
    watch: ['Výpadek ventilátorů musí vést na bezpečný stav (TSL)', 'Námraza na žebrech a odmrazování'],
  },
  WATER_BATH: {
    id: 'WATER_BATH',
    name: 'Vodní lázeň / ohřívač s vysokou tepelnou setrvačností (HTB)',
    pros: ['Nezávislý na teplotě vzduchu', 'Vysoká tepelná setrvačnost tlumí špičky'],
    risks: ['Provozní náklady na teplo (pára, elektřina, plyn)', 'Zamrznutí lázně při ztrátě ohřevu'],
    watch: ['Hlídání teploty lázně a hladiny', 'Ztráta ohřevu musí vést na bezpečný stav (TSL)'],
  },
  N_PLUS_1: {
    id: 'N_PLUS_1',
    name: 'N+1 (záložní větev)',
    pros: ['Dodávka pokračuje při odmrazování, údržbě i poruše jedné větve'],
    risks: ['Vyšší investice a prostor', 'Záložní větev musí být připravená (stav armatur)'],
    watch: ['Vyvážení paralelních větví (AIGA 027 čl. 8.10)', 'Pravidelné přepnutí na záložní větev'],
  },
};

/** Obecná pravidla návrhu (kap. 6.2), zobrazují se vždy. */
const DESIGN_RULES_CS: readonly string[] = [
  'Jmenovitá kapacita jedné provozní větve nikdy pod návrhovým průtokem ani pod ideální dolní mezí.',
  'Nad ideální dolní mezí je potřeba rezerva na námrazu a chybějící latentní teplo. Orientačně 1,2–1,5× průtoku, ' +
    'ale jen při přiblížení výstupní teploty k okolí ≈ 10 K. Je to odhad praxe, ne norma, a rozhoduje přepočet výrobce. ' +
    'Při menším přiblížení bývá potřeba výrazně víc.',
  'Velikost se posuzuje při minimální teplotě okolí lokality, na konci provozního cyklu (AIGA 027 §5).',
  'Hierarchie teplot: mez potrubí < TSL < návrhová T_out, např. −30 / −28 / −20 °C. TSL se nikdy nesnižuje kvůli častému vypínání.',
  'Odpařovače s malou tepelnou setrvačností (LTB) AIGA 027 čl. 8.8 pro nové instalace nedoporučuje.',
  'Paralelní větve se při uvedení do provozu vyvažují (AIGA 027 čl. 8.10).',
  'Výrobci mají různé katalogové základy. Modely různých výrobců nesrovnávej podle katalogových Nm³/h bez přepočtu.',
];

const CONCEPTS_EN: Readonly<Record<ConceptId, ConceptInfo>> = {
  SINGLE: {
    id: 'SINGLE',
    name: 'Single branch',
    pros: ['Simplest and cheapest solution', 'No switching valves'],
    risks: [
      'Below 0 °C the branch does not defrost even when idle – frost accumulates over the whole frost period',
      'No backup: defrosting or a failure interrupts supply',
    ],
    watch: [
      'The manufacturer must size for the frost period too (guarantee at T_min at the end of the cycle)',
      'Outlet temperature at the end of the shift in frost (T_out log, KPI)',
    ],
  },
  SWITCHED: {
    id: 'SWITCHED',
    name: 'Two branches with automatic switching',
    pros: ['The idle branch defrosts while the other one runs', 'Suitable for 24/7 operation'],
    risks: [
      'Switching failure (valve, control) lets cold gas through',
      'Below 0 °C the idle branch defrosts only slowly',
    ],
    watch: [
      'Timer 4–8 h + switchover on low outlet temperature; switching does NOT replace TSL',
      'Functional tests of switching and the KPI “switching failures”',
      'Balancing of parallel branches at commissioning (AIGA 027 cl. 8.10)',
    ],
  },
  ATM_HEATER: {
    id: 'ATM_HEATER',
    name: 'Ambient vaporizer + trim heater',
    pros: ['Reaches the outlet temperature even in frost', 'Smaller ambient part than with a small approach'],
    risks: ['Energy for the trim heater', 'Heater failure = cold gas into the piping'],
    watch: [
      'Section between vaporizer and trim heater in stainless steel',
      'TSL DOWNSTREAM of the trim heater',
      'Heater failure must shut off the supply (fail-close)',
    ],
  },
  FORCED_DRAFT: {
    id: 'FORCED_DRAFT',
    name: 'Forced draft (fans)',
    pros: ['Higher heat transfer, smaller footprint', 'Cold air does not stay around the unit'],
    risks: ['Depends on electrical power', 'Noise', 'Outlet temperature still limited by the air temperature'],
    watch: ['Fan failure must lead to a safe state (TSL)', 'Frost on the fins and defrosting'],
  },
  WATER_BATH: {
    id: 'WATER_BATH',
    name: 'Water bath / high-thermal-inertia heater (HTB)',
    pros: ['Independent of the air temperature', 'High thermal inertia damps peaks'],
    risks: ['Operating cost of heat (steam, electricity, gas)', 'Bath freezing on loss of heating'],
    watch: ['Monitoring of bath temperature and level', 'Loss of heating must lead to a safe state (TSL)'],
  },
  N_PLUS_1: {
    id: 'N_PLUS_1',
    name: 'N+1 (standby branch)',
    pros: ['Supply continues during defrosting, maintenance or failure of one branch'],
    risks: ['Higher investment and space', 'The standby branch must be ready (valve positions)'],
    watch: ['Balancing of parallel branches (AIGA 027 cl. 8.10)', 'Regular switchover to the standby branch'],
  },
};

const DESIGN_RULES_EN: readonly string[] = [
  'The rated capacity of one operating branch is never below the design flow nor below the ideal lower bound.',
  'Above the ideal lower bound a margin for frost and missing latent heat is needed. Roughly 1.2–1.5× the flow, but only at an ' +
    'outlet temperature approach to ambient of ≈ 10 K. This is a practical estimate, not a standard; the manufacturer’s re-rating decides. ' +
    'With a smaller approach considerably more is usually needed.',
  'Size at the minimum ambient temperature of the site, at the end of the operating cycle (AIGA 027 §5).',
  'Temperature hierarchy: piping limit < TSL < design T_out, e.g. −30 / −28 / −20 °C. TSL is never lowered because of frequent trips.',
  'AIGA 027 cl. 8.8 does not recommend low-thermal-inertia (LTB) vaporizers for new installations.',
  'Parallel branches are balanced at commissioning (AIGA 027 cl. 8.10).',
  'Manufacturers use different catalogue bases. Do not compare models of different manufacturers by catalogue Nm³/h without re-rating.',
];

/** Koncepty v aktuálním jazyce. */
export function concepts(): Readonly<Record<ConceptId, ConceptInfo>> {
  return getLang() === 'en' ? CONCEPTS_EN : CONCEPTS_CS;
}
/** Pravidla návrhu v aktuálním jazyce. */
export function designRules(): readonly string[] {
  return getLang() === 'en' ? DESIGN_RULES_EN : DESIGN_RULES_CS;
}
/** Kompatibilita (čeština). */
export const CONCEPTS = CONCEPTS_CS;
export const DESIGN_RULES = DESIGN_RULES_CS;

/** Popisek role v aktuálním jazyce. */
export function roleLabel(r: ConceptRole): string {
  return r === 'doporučeno' ? tr('doporučeno', 'recommended') : r === 'doplněk' ? tr('doplněk', 'add-on') : tr('zvážit', 'consider');
}

/** Přiblížení, pro které platí orientační rezerva 1,2–1,5× (kap. 6.2) [K]. */
export const PRACTICE_APPROACH_K = 10;
export const PRACTICE_RESERVE_RANGE: readonly [number, number] = [1.2, 1.5];

export interface ConceptInput {
  hoursPerDay: number;
  continuous24_7: boolean;
  frostWeeks: number | null;
  T_des_C: number;
  T_out_C: number;
  TSL_C: number | null;
  TSL_margin_K: number;
  availability: Availability;
  /** Očekávaná výstupní teplota bez dohřevu; null = dohřev se neuvažuje. */
  T_actual_out_C?: number | null;
}

export interface ConceptItem {
  id: ConceptId;
  role: ConceptRole;
  /** Proč aplikace koncept uvádí. */
  why: string[];
}

export interface ThreeVariants {
  why: string;
  variants: readonly { key: 'a' | 'b' | 'c'; text: string }[];
  note: string;
}

export interface ConceptRecommendation {
  approach_K: number;
  items: ConceptItem[];
  /** Explicitní nabídka (a)/(b)/(c) při přiblížení < 10 K a zároveň T_out − TSL < rezerva. */
  threeVariants: ThreeVariants | null;
  /** Doplňující poznámky (co doplnit, na co se zeptat). */
  notes: string[];
}

const fmt1 = (x: number) => fmt(x, 1);

export function recommendConcept(c: ConceptInput): ConceptRecommendation {
  const approach = c.T_des_C - c.T_out_C;
  const items = new Map<ConceptId, ConceptItem>();
  const add = (id: ConceptId, role: ConceptRole, why: string) => {
    const it = items.get(id);
    if (it) {
      it.why.push(why);
      // silnější role vyhrává: doporučeno > doplněk > zvážit
      const rank: Record<ConceptRole, number> = { doporučeno: 3, doplněk: 2, zvážit: 1 };
      if (rank[role] > rank[it.role]) it.role = role;
    } else items.set(id, { id, role, why: [why] });
  };
  const notes: string[] = [];
  const frost = c.T_des_C < 0;

  // 1) Profil provozu
  const longRun = c.continuous24_7 || c.hoursPerDay > 8;
  if (longRun) {
    add(
      'SWITCHED',
      'doporučeno',
      c.continuous24_7
        ? tr('Provoz 24/7: jedna větev nemá čas odtát.', '24/7 operation: a single branch has no time to defrost.')
        : tr(`Provoz ${c.hoursPerDay} h/den (> 8 h): na odtávání nezbývá dost času.`, `Operation ${c.hoursPerDay} h/day (> 8 h): not enough time left for defrosting.`),
    );
  } else {
    add('SINGLE', 'doporučeno', tr(`Provoz ${c.hoursPerDay} h/den (≤ 8 h) s odstávkou: větev může v odstávce odtát.`, `Operation ${c.hoursPerDay} h/day (≤ 8 h) with shutdown: the branch can defrost while idle.`));
    if (frost) {
      add(
        'SINGLE',
        'doporučeno',
        tr(
          `Teplota pro posouzení ${fmt1(c.T_des_C)} °C je pod 0 °C: větev v mrazu neodtává ani v odstávce – jedna větev jen tehdy, když ji výrobce dimenzuje i na mrazové období.`,
          `Design air temperature ${fmt1(c.T_des_C)} °C is below 0 °C: in frost the branch does not defrost even when idle – a single branch only if the manufacturer sizes it for the frost period too.`,
        ),
      );
      if (c.frostWeeks !== null && c.frostWeeks > 0)
        add('SWITCHED', 'zvážit', tr(`Mrazové období ${c.frostWeeks} týdnů: námraza se kumuluje; přepínané větve odtávají střídavě.`, `Frost period ${c.frostWeeks} weeks: frost accumulates; switched branches defrost alternately.`));
      else if (c.frostWeeks === null)
        add('SWITCHED', 'zvážit', tr('Délka mrazového období není zadaná – při delším mrazu se námraza kumuluje; zvaž přepínané větve.', 'Length of the frost period not set – in a longer frost the ice accumulates; consider switched branches.'));
    }
  }
  if (longRun && frost) {
    const why = tr(
      'Provoz bez odstávek v mrazu: odstavená větev pod 0 °C prakticky neodtává, takže přepínání kapacitu neobnoví.',
      'Operation without shutdowns in frost: an idle branch below 0 °C hardly defrosts, so switching does not restore the capacity.',
    );
    add('ATM_HEATER', 'zvážit', `${why} ${tr('Dohřev nebo třetí větev; rozhodne přepočet výrobce na mrazové období.', 'A trim heater or a third branch; the manufacturer’s re-rating for the frost period decides.')}`);
    add('FORCED_DRAFT', 'zvážit', `${why} ${tr('Nucený tah zlepší přestup tepla.', 'Forced draft improves heat transfer.')}`);
  }
  if (frost && c.frostWeeks === null)
    notes.push(tr('Délka mrazového období není zadaná – doplň ji; rozhoduje o jedné vs. přepínaných větvích a patří do poptávky.', 'Length of the frost period not set – fill it in; it decides between one and switched branches and belongs in the enquiry.'));

  // 2) Dosažitelnost výstupní teploty a přiblížení
  if (!(approach > 0)) {
    const why = tr(
      `Při ${fmt1(c.T_des_C)} °C nelze výstupní teploty ${fmt1(c.T_out_C)} °C atmosférickým odpařovačem dosáhnout.`,
      `At ${fmt1(c.T_des_C)} °C an ambient vaporizer cannot reach the outlet temperature ${fmt1(c.T_out_C)} °C.`,
    );
    add('ATM_HEATER', 'doplněk', `${why} ${tr('Nutný dohřev nebo jiný typ + TSL.', 'Trim heater or another type + TSL needed.')}`);
    add('WATER_BATH', 'zvážit', `${why} ${tr('Zdroj tepla nezávislý na vzduchu.', 'Heat source independent of the air.')}`);
  } else if (approach < PRACTICE_APPROACH_K) {
    const why = tr(
      `Přiblížení ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K: orientační rezerva 1,2–1,5× neplatí, atmosférický odpařovač bývá výrazně větší.`,
      `Approach ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K: the rough 1.2–1.5× margin does not apply, the ambient vaporizer is usually much larger.`,
    );
    add('ATM_HEATER', 'zvážit', `${why} ${tr('Nižší T_out + dohřev zmenší atmosférickou část.', 'A lower T_out + trim heater reduces the ambient part.')}`);
    add('FORCED_DRAFT', 'zvážit', `${why} ${tr('Nucený tah zvýší přestup tepla.', 'Forced draft increases heat transfer.')}`);
    add('WATER_BATH', 'zvážit', `${why} ${tr('Vodní lázeň nezávisí na teplotě vzduchu.', 'A water bath does not depend on the air temperature.')}`);
  }

  // 2b) Plánovaný dohřev (očekávaná T_out bez dohřevu nižší než návrhová)
  if (c.T_actual_out_C !== undefined && c.T_actual_out_C !== null && c.T_actual_out_C < c.T_out_C)
    add(
      'ATM_HEATER',
      'doplněk',
      tr(
        `Očekávaná výstupní teplota bez dohřevu ${fmt1(c.T_actual_out_C)} °C je pod návrhovou ${fmt1(c.T_out_C)} °C – dohřev je součástí konceptu.`,
        `Expected outlet temperature without heater ${fmt1(c.T_actual_out_C)} °C is below the design ${fmt1(c.T_out_C)} °C – a trim heater is part of the concept.`,
      ),
    );

  // 3) Dostupnost
  if (c.availability === 'N+1') add('N_PLUS_1', 'doplněk', tr('Požadovaná dostupnost N+1: záložní větev plné kapacity.', 'Required availability N+1: full-capacity standby branch.'));
  if (c.availability === 'backup-heater')
    add('WATER_BATH', 'doplněk', tr('Požadovaná dostupnost: záložní ohřívač (vodní lázeň nebo jiný nezávislý zdroj tepla).', 'Required availability: backup heater (water bath or another independent heat source).'));

  // 4) Tři varianty (a)/(b)/(c)
  let threeVariants: ThreeVariants | null = null;
  if (c.TSL_C !== null && approach < PRACTICE_APPROACH_K && c.T_out_C - c.TSL_C < c.TSL_margin_K) {
    threeVariants = {
      why: tr(
        `Přiblížení ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K a zároveň rezerva T_out − TSL = ${fmt1(c.T_out_C - c.TSL_C)} K < požadovaných ${fmt1(c.TSL_margin_K)} K.`,
        `Approach ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K and at the same time margin T_out − TSL = ${fmt1(c.T_out_C - c.TSL_C)} K < required ${fmt1(c.TSL_margin_K)} K.`,
      ),
      variants: [
        { key: 'a', text: tr('větší odpařovač', 'a larger vaporizer') },
        { key: 'b', text: tr('nižší T_out + dohřev', 'a lower T_out + trim heater') },
        {
          key: 'c',
          text: tr(
            'první úsek potrubí z nerezu nebo nízkoteplotní oceli, takže lze nižší mez potrubí i nižší TSL',
            'a first piping section of stainless or low-temperature steel, allowing a lower piping limit and a lower TSL',
          ),
        },
      ],
      note: tr('Rozhodnutí patří do analýzy rizik.', 'The decision belongs in the risk analysis.'),
    };
  }

  const order: Record<ConceptRole, number> = { doporučeno: 0, doplněk: 1, zvážit: 2 };
  return {
    approach_K: approach,
    items: [...items.values()].sort((a, b) => order[a.role] - order[b.role]),
    threeVariants,
    notes,
  };
}
