/**
 * Doporučení konceptu (kap. 6.3) – rozhodovací logika z pravidel praxe (kap. 6.2).
 * Vše je PRAXE: odůvodněné doporučení k analýze rizik, ne závazný výběr.
 *
 * Vstupy: profil provozu, délka mrazového období, T_des, přiblížení (T_des − T_out),
 * dostupnost, TSL a požadovaná rezerva. Prostor se zadává až v poptávce; zde jen „co hlídat“.
 */
import { fmt } from './format';
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

export const CONCEPTS: Readonly<Record<ConceptId, ConceptInfo>> = {
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
export const DESIGN_RULES: readonly string[] = [
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
        ? 'Provoz 24/7: jedna větev nemá čas odtát.'
        : `Provoz ${c.hoursPerDay} h/den (> 8 h): na odtávání nezbývá dost času.`,
    );
  } else {
    add('SINGLE', 'doporučeno', `Provoz ${c.hoursPerDay} h/den (≤ 8 h) s odstávkou: větev může v odstávce odtát.`);
    if (frost) {
      add(
        'SINGLE',
        'doporučeno',
        `Teplota pro posouzení ${fmt1(c.T_des_C)} °C je pod 0 °C: větev v mrazu neodtává ani v odstávce – jedna větev jen tehdy, když ji výrobce dimenzuje i na mrazové období.`,
      );
      if (c.frostWeeks !== null && c.frostWeeks > 0)
        add('SWITCHED', 'zvážit', `Mrazové období ${c.frostWeeks} týdnů: námraza se kumuluje; přepínané větve odtávají střídavě.`);
      else if (c.frostWeeks === null)
        add('SWITCHED', 'zvážit', 'Délka mrazového období není zadaná – při delším mrazu se námraza kumuluje; zvaž přepínané větve.');
    }
  }
  if (longRun && frost) {
    const why =
      'Provoz bez odstávek v mrazu: odstavená větev pod 0 °C prakticky neodtává, takže přepínání kapacitu neobnoví.';
    add('ATM_HEATER', 'zvážit', `${why} Dohřev nebo třetí větev; rozhodne přepočet výrobce na mrazové období.`);
    add('FORCED_DRAFT', 'zvážit', `${why} Nucený tah zlepší přestup tepla.`);
  }
  if (frost && c.frostWeeks === null)
    notes.push('Délka mrazového období není zadaná – doplň ji; rozhoduje o jedné vs. přepínaných větvích a patří do poptávky.');

  // 2) Dosažitelnost výstupní teploty a přiblížení
  if (!(approach > 0)) {
    const why = `Při ${fmt1(c.T_des_C)} °C nelze výstupní teploty ${fmt1(c.T_out_C)} °C atmosférickým odpařovačem dosáhnout.`;
    add('ATM_HEATER', 'doplněk', `${why} Nutný dohřev nebo jiný typ + TSL.`);
    add('WATER_BATH', 'zvážit', `${why} Zdroj tepla nezávislý na vzduchu.`);
  } else if (approach < PRACTICE_APPROACH_K) {
    const why =
      `Přiblížení ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K: orientační rezerva 1,2–1,5× neplatí, ` +
      'atmosférický odpařovač bývá výrazně větší.';
    add('ATM_HEATER', 'zvážit', `${why} Nižší T_out + dohřev zmenší atmosférickou část.`);
    add('FORCED_DRAFT', 'zvážit', `${why} Nucený tah zvýší přestup tepla.`);
    add('WATER_BATH', 'zvážit', `${why} Vodní lázeň nezávisí na teplotě vzduchu.`);
  }

  // 2b) Plánovaný dohřev (očekávaná T_out bez dohřevu nižší než návrhová)
  if (c.T_actual_out_C !== undefined && c.T_actual_out_C !== null && c.T_actual_out_C < c.T_out_C)
    add(
      'ATM_HEATER',
      'doplněk',
      `Očekávaná výstupní teplota bez dohřevu ${fmt1(c.T_actual_out_C)} °C je pod návrhovou ${fmt1(c.T_out_C)} °C – dohřev je součástí konceptu.`,
    );

  // 3) Dostupnost
  if (c.availability === 'N+1') add('N_PLUS_1', 'doplněk', 'Požadovaná dostupnost N+1: záložní větev plné kapacity.');
  if (c.availability === 'backup-heater')
    add('WATER_BATH', 'doplněk', 'Požadovaná dostupnost: záložní ohřívač (vodní lázeň nebo jiný nezávislý zdroj tepla).');

  // 4) Tři varianty (a)/(b)/(c)
  let threeVariants: ThreeVariants | null = null;
  if (c.TSL_C !== null && approach < PRACTICE_APPROACH_K && c.T_out_C - c.TSL_C < c.TSL_margin_K) {
    threeVariants = {
      why:
        `Přiblížení ${fmt1(approach)} K < ${PRACTICE_APPROACH_K} K a zároveň rezerva T_out − TSL = ${fmt1(c.T_out_C - c.TSL_C)} K ` +
        `< požadovaných ${fmt1(c.TSL_margin_K)} K.`,
      variants: [
        { key: 'a', text: 'větší odpařovač' },
        { key: 'b', text: 'nižší T_out + dohřev' },
        {
          key: 'c',
          text: 'první úsek potrubí z nerezu nebo nízkoteplotní oceli, takže lze nižší mez potrubí i nižší TSL',
        },
      ],
      note: 'Rozhodnutí patří do analýzy rizik.',
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
