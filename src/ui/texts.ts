/**
 * Texty UI (CZ). Technické termíny anglicky v závorce. Oddělené od komponent
 * kvůli pozdějšímu přepínači CZ/EN.
 */

export interface FieldText {
  label: string;
  /** Tooltip „proč na tom záleží“. */
  help: string;
}

export const FIELD = {
  fluid: {
    label: 'Látka',
    help:
      'Látka určuje stavovou rovnici, výchozí teplotu kapaliny, rozsah tlaku a sloupec katalogu (LOX / LIN / LAR). ' +
      'Dusík je omezen na 32 bar a: nad kritickým tlakem 33,96 bar kapalina nevře a model dvou zón neplatí. ' +
      'Kyslík a argon: 1–40 bar a.',
  },
  flow: {
    label: 'Špičkový návrhový průtok (peak flow)',
    help:
      'Zadej špičku, ne průměr. Odpařovač musí špičku přenést i na konci provozního cyklu, kdy je namrzlý. ' +
      'Nm³ = 0 °C a 1,01325 bar; 1 Nm³ = 1,0549 Sm³ (15 °C) ≈ 37,3 scf (60 °F) ≈ 38,0 scf (70 °F).',
  },
  avgFlow: {
    label: 'Průměrný průtok (average flow)',
    help: 'Volitelné, pro poptávku. Výrobce z poměru špička / průměr odhaduje námrazu a potřebu přepínání větví.',
  },
  pressure: {
    label: 'Provozní tlak (operating pressure)',
    help:
      'Tlak určuje teplotu varu a výparné teplo. S rostoucím tlakem roste T_sat a klesá výparné teplo, roste ale ' +
      'podíl přehřátí. Tlaková ztráta se zanedbává (0,5 bar změní výkon jen o +0,05 %).',
  },
  p_atm: {
    label: 'Atmosférický tlak',
    help: 'Pro převod přetlaku (barg) na absolutní tlak. Výchozí 1,01325 bar; v nadmořské výšce 500 m je asi 0,955 bar.',
  },
  liquid: {
    label: 'Stav kapaliny na vstupu',
    help:
      'Podchlazená kapalina potřebuje víc tepla než nasycená (ohřev na bod varu q₁). Návrhový případ je podchlazená ' +
      'kapalina z nádrže; nasycená kapalina při provozním tlaku dává minimum výkonu.',
  },
  T_in: {
    label: 'Teplota kapaliny (liquid temperature)',
    help:
      'Výchozí −183 °C (O₂) / −196 °C (N₂) odpovídá kapalině blízko bodu varu při atmosférickém tlaku. ' +
      'Musí ležet mezi dolní mezí tabulky (těsně nad trojným bodem) a teplotou nasycení při provozním tlaku.',
  },
  T_out: {
    label: 'Návrhová výstupní teplota plynu (outlet temperature)',
    help:
      'Musí být pod teplotou okolí a nad mezí navazujícího potrubí i TSL s rezervou. Čím blíž k teplotě okolí, ' +
      'tím větší odpařovač – výkon v kW se přitom mění jen málo.',
  },
  T_amb: {
    label: 'Teplota okolí pro výpočet (ambient)',
    help:
      'Výkon v kW na teplotě okolí nezávisí, velikost odpařovače ano. Pro posouzení velikosti se použije ' +
      'MIN(teplota okolí, minimální teplota lokality).',
  },
  T_min_site: {
    label: 'Minimální návrhová teplota okolí lokality',
    help:
      'Velikost se posuzuje při minimální teplotě lokality na konci provozního cyklu (AIGA 027 §5). ' +
      'ČSN výpočtové teploty pro vytápění nejsou absolutní minima.',
  },
  RH: {
    label: 'Relativní vlhkost v zimě (RH)',
    help:
      'Vlhkost určuje námrazu a latentní teplo, které vzduch odevzdá při vymrzání vody. Jen pro vysvětlující model a poptávku.',
  },
  frostWeeks: {
    label: 'Délka mrazového období',
    help: 'Jak dlouho větev pod 0 °C neodtává. Rozhoduje o jedné větvi vs. přepínaných větvích; pro poptávku a koncept.',
  },
  T_pipe_min: {
    label: 'Min. návrhová teplota navazujícího potrubí',
    help:
      'Nejnižší teplota, pro kterou jsou materiály navazujícího potrubí navrženy. Plyn chladnější než tato mez = ' +
      'riziko křehkého lomu (brittle fracture, AIGA 027).',
  },
  TSL: {
    label: 'Nastavení TSL (temperature safety low)',
    help:
      'Ochrana při nízké výstupní teplotě (AIGA 027). Hierarchie: mez potrubí < TSL < návrhová T_out, např. −30 / −28 / −20 °C. ' +
      'TSL se nikdy nesnižuje kvůli častému vypínání.',
  },
  TSL_margin: {
    label: 'Požadovaná rezerva T_out nad TSL',
    help: 'Rezerva mezi návrhovou výstupní teplotou a TSL, aby odpařovač nevypínal při běžném kolísání a námraze.',
  },
  hoursPerDay: {
    label: 'Profil provozu',
    help:
      'Při ≤ 8 h/den s odstávkou větev odtává a obvykle stačí jedna; při 24/7 se používají dvě větve s automatickým ' +
      'přepínáním. Určuje také spotřebu kapaliny za den.',
  },
  availability: {
    label: 'Požadovaná dostupnost',
    help: 'N = jedna provozní kapacita; N+1 = záložní větev; záložní ohřívač = jiný zdroj tepla jako záloha. Pro koncept a poptávku.',
  },
  T_actual_out: {
    label: 'Očekávaná výstupní teplota bez dohřevu',
    help:
      'Volitelné. Teplota, kterou odpařovač skutečně dá (např. v mrazu na konci cyklu). Aplikace spočítá výkon dohřevu ' +
      'na návrhovou výstupní teplotu.',
  },
  basis: {
    label: 'Katalogový základ výrobce',
    help:
      'Podmínky, za kterých výrobce udává kapacitu v Nm³/h (ÚDAJ VÝROBCE, ilustrativní). Výrobci mají různé základy – ' +
      'modely různých výrobců nesrovnávej bez přepočtu. Použije se v posouzení velikosti.',
  },
  k: {
    label: 'Koeficient námrazy / rezervy k',
    help:
      'Zadává uživatel; aplikace nenavrhuje vlastní „univerzální“ hodnotu. Orientačně 1,2–1,5× jen při přiblížení ' +
      'výstupní teploty k okolí ≈ 10 K – odhad praxe, ne norma; rozhoduje přepočet výrobce.',
  },
} satisfies Record<string, FieldText>;

export const APP = {
  title: 'Atmosférický odpařovač kryogenních kapalin',
  subtitle: 'Výpočet tepelné potřeby, kontroly bezpečnosti a podklady pro návrh',
  disclaimer:
    'Aplikace není náhradou výběru a garance výrobce. Velikost odpařovače vždy potvrzuje výrobce přepočtem na konkrétní lokalitu.',
  notKw:
    'Výkon v kW je fyzika a jde spočítat přesně. Atmosférický odpařovač ale „nemá výkon“ – předá tolik tepla, kolik dovolí ' +
    'vzduch, plocha a námraza (Q = U·A·ΔT). Vybírá se podle průtoku v Nm³/h, minimální teploty okolí, vlhkosti a profilu provozu.',
};

export const SOURCE_LABEL = {
  VYPOCET: { short: 'VÝP', long: 'VÝPOČET – fyzika (stavová rovnice, bilance)' },
  PRAXE: { short: 'PRX', long: 'PRAXE – pravidlo nebo odhad z praxe' },
  VYROBCE: { short: 'VÝR', long: 'ÚDAJ VÝROBCE – katalog, ilustrativní' },
  VSTUP: { short: 'VST', long: 'VSTUP – zadáno uživatelem' },
} as const;

export type Source = keyof typeof SOURCE_LABEL;
