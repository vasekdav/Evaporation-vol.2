import { getLang } from '../core/i18n';
/**
 * Texty UI (CZ). Technické termíny anglicky v závorce. Oddělené od komponent
 * kvůli pozdějšímu přepínači CZ/EN.
 */

export interface FieldText {
  label: string;
  /** Tooltip „proč na tom záleží“. */
  help: string;
}

const FIELD_CS = {
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
      'podíl přehřátí. Tlaková ztráta se zanedbává (0,5 bar tlakové ztráty by zvýšilo výkon o +0,05 až +0,15 % podle tlaku a T_out).',
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
    label: 'Koeficient námrazy / rezervy k (násobí N_eq)',
    help:
      'Zadává uživatel; aplikace nenavrhuje vlastní „univerzální“ hodnotu. Pozor: k násobí ideální ekvivalent N_eq, ne průtok. ' +
      'Orientační pravidlo praxe „1,2–1,5× průtoku“ (jen při přiblížení výstupní teploty k okolí ≈ 10 K) se týká PRŮTOKU – ' +
      'aplikace ho ukazuje zvlášť u posouzení velikosti. Rozhoduje přepočet výrobce.',
  },
} satisfies Record<string, FieldText>;

const APP_CS = {
  title: 'Atmosférický odpařovač kryogenních kapalin',
  subtitle: 'Výpočet tepelné potřeby, kontroly bezpečnosti a podklady pro návrh',
  disclaimer:
    'Aplikace není náhradou výběru a garance výrobce. Velikost odpařovače vždy potvrzuje výrobce přepočtem na konkrétní lokalitu.',
  notKw:
    'Výkon v kW je fyzika a jde spočítat přesně. Atmosférický odpařovač ale „nemá výkon“ – předá tolik tepla, kolik dovolí ' +
    'vzduch, plocha a námraza (Q = U·A·ΔT). Vybírá se podle průtoku v Nm³/h, minimální teploty okolí, vlhkosti a profilu provozu.',
};

const SOURCE_LABEL_CS = {
  VYPOCET: { short: 'VÝP', long: 'VÝPOČET – fyzika (stavová rovnice, bilance)' },
  PRAXE: { short: 'PRX', long: 'PRAXE – pravidlo nebo odhad z praxe' },
  VYROBCE: { short: 'VÝR', long: 'ÚDAJ VÝROBCE – katalog, ilustrativní' },
  VSTUP: { short: 'VST', long: 'VSTUP – zadáno uživatelem' },
};

export type Source = keyof typeof SOURCE_LABEL_CS;

const FIELD_EN: Record<keyof typeof FIELD_CS, FieldText> = {
  fluid: {
    label: 'Fluid',
    help:
      'The fluid determines the equation of state, the default liquid temperature, the pressure range and the catalogue column (LOX / LIN / LAR). ' +
      'Nitrogen is limited to 32 bar a: above the critical pressure of 33.96 bar the liquid does not boil and the two-zone model does not apply. ' +
      'Oxygen and argon: 1–40 bar a.',
  },
  flow: {
    label: 'Peak design flow',
    help:
      'Enter the peak, not the average. The vaporizer must handle the peak even at the end of the operating cycle when it is frosted. ' +
      'Nm³ = 0 °C and 1.01325 bar; 1 Nm³ = 1.0549 Sm³ (15 °C) ≈ 37.3 scf (60 °F) ≈ 38.0 scf (70 °F).',
  },
  avgFlow: {
    label: 'Average flow',
    help: 'Optional, for the enquiry. From the peak / average ratio the manufacturer estimates frosting and the need for branch switching.',
  },
  pressure: {
    label: 'Operating pressure',
    help:
      'Pressure determines the boiling temperature and the latent heat. With rising pressure T_sat rises and the latent heat falls, while the ' +
      'share of superheating grows. Pressure drop is neglected (0.5 bar of pressure drop would raise the duty by +0.05 to +0.15 % depending on pressure and T_out).',
  },
  p_atm: {
    label: 'Atmospheric pressure',
    help: 'For converting gauge pressure (barg) to absolute. Default 1.01325 bar; at 500 m altitude it is about 0.955 bar.',
  },
  liquid: {
    label: 'Liquid state at the inlet',
    help:
      'Subcooled liquid needs more heat than saturated liquid (warming to the boiling point q₁). The design case is subcooled liquid from the tank; ' +
      'saturated liquid at operating pressure gives the minimum duty.',
  },
  T_in: {
    label: 'Liquid temperature',
    help:
      'The default −183 °C (O₂) / −196 °C (N₂) / −186 °C (Ar) corresponds to liquid close to its boiling point at atmospheric pressure. ' +
      'It must lie between the table limit (just above the triple point / melting line) and the saturation temperature at operating pressure.',
  },
  T_out: {
    label: 'Design gas outlet temperature',
    help:
      'Must be below the ambient temperature and above the downstream piping limit and the TSL with a margin. The closer to ambient, ' +
      'the larger the vaporizer – while the duty in kW changes only a little.',
  },
  T_amb: {
    label: 'Ambient temperature for calculation',
    help:
      'The duty in kW does not depend on the ambient temperature, the vaporizer size does. Sizing uses ' +
      'MIN(ambient temperature, minimum site temperature).',
  },
  T_min_site: {
    label: 'Minimum design ambient temperature of the site',
    help:
      'Size at the minimum site temperature at the end of the operating cycle (AIGA 027 §5). ' +
      'Design temperatures for heating (ČSN) are not absolute minima.',
  },
  RH: {
    label: 'Relative humidity in winter (RH)',
    help: 'Humidity determines frosting and the latent heat the air gives off when water freezes out. Used only in the explanatory model and the enquiry.',
  },
  frostWeeks: {
    label: 'Length of frost period',
    help: 'How long a branch does not defrost below 0 °C. Decides between one branch and switched branches; for the enquiry and the concept.',
  },
  T_pipe_min: {
    label: 'Min. design temperature of downstream piping',
    help:
      'The lowest temperature the downstream piping materials are designed for. Gas colder than this limit = ' +
      'risk of brittle fracture (AIGA 027).',
  },
  TSL: {
    label: 'TSL setting (temperature safety low)',
    help:
      'Low outlet temperature protection (AIGA 027). Hierarchy: piping limit < TSL < design T_out, e.g. −30 / −28 / −20 °C. ' +
      'TSL is never lowered because of frequent trips.',
  },
  TSL_margin: {
    label: 'Required margin of T_out above TSL',
    help: 'Margin between the design outlet temperature and the TSL so that the vaporizer does not trip on normal fluctuations and frosting.',
  },
  hoursPerDay: {
    label: 'Operating profile',
    help:
      'With ≤ 8 h/day and a shutdown the branch defrosts and one branch is usually enough; for 24/7 two branches with automatic ' +
      'switching are used. Also determines the liquid consumption per day.',
  },
  availability: {
    label: 'Required availability',
    help: 'N = one operating capacity; N+1 = standby branch; backup heater = another heat source as backup. For the concept and the enquiry.',
  },
  T_actual_out: {
    label: 'Expected outlet temperature without trim heater',
    help:
      'Optional. The temperature the vaporizer actually delivers (e.g. in frost at the end of the cycle). The app calculates the trim heater duty ' +
      'to the design outlet temperature.',
  },
  basis: {
    label: 'Manufacturer catalogue basis',
    help:
      'Conditions under which the manufacturer states the capacity in Nm³/h (MANUFACTURER DATA, illustrative). Manufacturers use different bases – ' +
      'do not compare models of different manufacturers without re-rating. Used in the sizing assessment.',
  },
  k: {
    label: 'Frost / margin factor k (multiplies N_eq)',
    help:
      'Entered by the user; the app does not propose a “universal” value. Note: k multiplies the ideal equivalent N_eq, not the flow. ' +
      'The practical rule “1.2–1.5× the flow” (only at an outlet temperature approach to ambient of ≈ 10 K) concerns the FLOW – ' +
      'the app shows it separately in the sizing assessment. The manufacturer’s re-rating decides.',
  },
};

const APP_EN: typeof APP_CS = {
  title: 'Ambient vaporizer for cryogenic liquids',
  subtitle: 'Heat duty calculation, safety checks and design basis',
  disclaimer:
    'The application is no substitute for the manufacturer’s selection and guarantee. The vaporizer size is always confirmed by the manufacturer’s re-rating to the specific site.',
  notKw:
    'Duty in kW is physics and can be calculated exactly. An ambient vaporizer, however, “has no duty” – it transfers as much heat as the ' +
    'air, the surface and the frost allow (Q = U·A·ΔT). It is selected by the flow in Nm³/h, the minimum ambient temperature, humidity and the operating profile.',
};

const SOURCE_LABEL_EN: typeof SOURCE_LABEL_CS = {
  VYPOCET: { short: 'CALC', long: 'CALCULATION – physics (equation of state, balance)' },
  PRAXE: { short: 'PRAC', long: 'PRACTICE – rule or estimate from practice' },
  VYROBCE: { short: 'MFR', long: 'MANUFACTURER DATA – catalogue, illustrative' },
  VSTUP: { short: 'INP', long: 'INPUT – entered by the user' },
};

/** Texty v aktuálním jazyce (Proxy, aby se použití v komponentách neměnilo). */
function byLang<T extends object>(cs: T, en: T): T {
  return new Proxy(cs, { get: (_t, k) => (getLang() === 'en' ? en : cs)[k as keyof T] });
}
export const FIELD = byLang<typeof FIELD_CS>(FIELD_CS, FIELD_EN as typeof FIELD_CS);
export const APP = byLang(APP_CS, APP_EN);
export const SOURCE_LABEL = byLang(SOURCE_LABEL_CS, SOURCE_LABEL_EN);
