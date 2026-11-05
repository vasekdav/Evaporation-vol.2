/**
 * Generátor poptávky pro výrobce (kap. 8 bod 8). Formulář je předvyplněný ze vstupů
 * a výsledků; ke každé položce je „proč to výrobce potřebuje“. Pole svázaná se
 * vstupy výpočtu se kontrolují: když je uživatel přepíše jinak, než odpovídá vstupům,
 * aplikace to ohlásí.
 */
import type { CatalogBasis } from './catalog';
import type { Evaluation } from './evaluate';
import { FLUID_POLICY } from './fluids';
import { fmt } from './format';
import { tr } from './i18n';
import { toNm3h } from './units';

export type InquirySource = 'VSTUP' | 'VYPOCET' | 'PRAXE' | 'DOPLNIT';

export interface InquiryField {
  /** jedinečný klíč pole, např. „guarantee.peak“ */
  key: string;
  label: string;
  /** předvyplněná hodnota (prázdná u polí k doplnění) */
  prefill: string;
  source: InquirySource;
  /** pole je odvozené ze vstupů výpočtu – kontroluje se shoda */
  linked: boolean;
  hint?: string;
  multiline?: boolean;
}

export interface InquiryItem {
  id: string;
  title: string;
  /** proč to výrobce potřebuje */
  why: string;
  fields: InquiryField[];
}

/** Uživatelské úpravy polí: klíč pole → text. */
export type InquiryOverrides = Readonly<Record<string, string>>;

const T = (x: number, d = 0) => `${fmt(x, d)} °C`;

function field(
  key: string,
  label: string,
  prefill: string,
  source: InquirySource,
  linked = false,
  extra: Partial<Pick<InquiryField, 'hint' | 'multiline'>> = {},
): InquiryField {
  return { key, label, prefill, source, linked, ...extra };
}

const todo = (key: string, label: string, hint: string, multiline = false) => field(key, label, '', 'DOPLNIT', false, { hint, multiline });

export function buildInquiry(ev: Evaluation, basis?: CatalogBasis): InquiryItem[] {
  const inp = ev.input;
  const pol = FLUID_POLICY[inp.fluid];
  const isO2 = inp.fluid === 'O2';
  const d = ev.duty;
  const p_abs = ev.p_bar_a;
  const pressure =
    inp.pressure.kind === 'gauge'
      ? `${fmt(inp.pressure.value, 2)} barg${p_abs !== null ? ` (${fmt(p_abs, 3)} bar a)` : ''}`
      : `${fmt(inp.pressure.value, 3)} bar a`;
  const liquid =
    inp.liquid.kind === 'saturated'
      ? tr('nasycená kapalina při provozním tlaku', 'saturated liquid at operating pressure')
      : tr(`podchlazená kapalina ${T(inp.liquid.T_C, 1)}`, `subcooled liquid ${T(inp.liquid.T_C, 1)}`);
  const flowNm3 = `${fmt(toNm3h(inp.flow), 0)} Nm³/h`;
  const flowPeak = `${flowNm3} (${tr('špička', 'peak')})`;
  const flowAvg = inp.avgFlow ? `${fmt(toNm3h(inp.avgFlow), 0)} Nm³/h` : tr('nezadáno', 'not set');
  const profile = inp.continuous24_7 ? tr('nepřetržitě 24/7', 'continuous 24/7') : tr(`${fmt(inp.hoursPerDay, 0)} h/den s odstávkou`, `${fmt(inp.hoursPerDay, 0)} h/day with shutdown`);
  const switched = ev.concept?.items.some((i) => i.id === 'SWITCHED' && i.role === 'doporučeno') ?? false;
  const nPlus1 = inp.availability === 'N+1';
  const sizing = ev.sizing?.ok ? ev.sizing : null;
  const T_in = inp.liquid.kind === 'subcooled' ? inp.liquid.T_C : (ev.duty?.T_sat_C ?? -196);
  const tsMin = Math.min(-196, T_in);
  const cycle = inp.continuous24_7 || inp.hoursPerDay > 8 ? null : `${fmt(inp.hoursPerDay, 0)} h`;
  const cycleTxt = cycle ?? tr('[délka cyklu / interval přepnutí] h', '[cycle length / switching interval] h');
  const tminTxt = inp.T_min_site_C !== null ? T(inp.T_min_site_C) : tr('[T_min lokality]', '[site T_min]');
  const frostTxt = inp.frostWeeks !== null ? tr(`, ${fmt(inp.frostWeeks, 0)} týdnů mrazu`, `, ${fmt(inp.frostWeeks, 0)} weeks of frost`) : '';
  const guarantee = tr(
    `${flowNm3} na jednu provozní větev s výstupní teplotou ≥ ${T(inp.T_out_C)} na konci ${cycleTxt} provozu od startu z odmraženého stavu, při teplotě okolí ${tminTxt}, RH ${fmt(inp.RH_winter_pct, 0)} %${frostTxt}. Požadujeme přepočtovou tabulku kapacity podle teploty okolí.`,
    `${flowNm3} per operating branch with outlet temperature ≥ ${T(inp.T_out_C)} at the end of ${cycleTxt} of operation from a defrosted start, at an ambient temperature of ${tminTxt}, RH ${fmt(inp.RH_winter_pct, 0)} %${frostTxt}. We require a re-rating table of capacity versus ambient temperature.`,
  );

  return [
    {
      id: 'project',
      title: tr('Identifikace a rozsah', 'Identification and scope'),
      why: tr('Lokalita určuje klimatická data a zatížení konstrukce; počet větví a termín určují nabídku a výrobní kapacitu.', 'The site determines the climate data and structural loads; the number of branches and the deadline determine the offer and production capacity.'),
      fields: [
        todo('project.site', tr('Lokalita (adresa, nadmořská výška)', 'Site (address, altitude)'), tr('Výrobce z ní přepočítává kapacitu na místní klima.', 'The manufacturer re-rates the capacity to the local climate from it.')),
        todo('project.contact', tr('Zákazník / kontaktní osoba', 'Customer / contact person'), ''),
        todo('project.deadline', tr('Požadovaný termín dodávky', 'Required delivery date'), ''),
        field(
          'project.branches',
          tr('Počet a uspořádání větví', 'Number and arrangement of branches'),
          (switched ? tr('2 × 100 % přepínané větve (1 v provozu, 1 odtává)', '2 × 100 % switched branches (1 operating, 1 defrosting)') : tr('1 provozní větev 100 %', '1 operating branch 100 %')) +
            (nPlus1 ? tr(' + 1 další záložní větev 100 % (N+1)', ' + 1 additional standby branch 100 % (N+1)') : ''),
          'PRAXE',
          true,
        ),
        todo(
          'project.space',
          tr('Prostor a dispozice', 'Space and layout'),
          tr('Půdorys, max. výška (větší jednotky ~7 m), odstupy od budov a mezi jednotkami, přístup pro odmrazování a údržbu.', 'Footprint, max. height (larger units ~7 m), distances from buildings and between units, access for defrosting and maintenance.'),
          true,
        ),
      ],
    },
    {
      id: 'source',
      title: tr('Zdroj kapaliny', 'Liquid source'),
      why: tr('Teplota a tlak kapaliny určují teplo na ohřev a var; zdroj (nádrž, čerpadlo) mění podchlazení a kolísání tlaku.', 'Liquid temperature and pressure determine the heat for warming and boiling; the source (tank, pump) changes the subcooling and pressure fluctuations.'),
      fields: [
        field('source.fluid', tr('Médium', 'Medium'), `${pol.liquidLabel} – ${tr(pol.name_cs, pol.name_en)} (${pol.formula})`, 'VSTUP', true),
        field('source.liquid', tr('Stav kapaliny na vstupu', 'Liquid state at the inlet'), liquid, 'VSTUP', true),
        field('source.pressure', tr('Provozní tlak', 'Operating pressure'), pressure, 'VSTUP', true),
        todo('source.tank', tr('Zdroj (nádrž, objem, pojistný tlak, čerpadlo ano/ne)', 'Source (tank, volume, relief pressure, pump yes/no)'), tr('Např. zásobník 30 m³, pojistný ventil 18 bar, bez čerpadla.', 'E.g. 30 m³ tank, relief valve 18 bar, no pump.'), true),
      ],
    },
    {
      id: 'ped',
      title: tr('PS / TS a kategorie PED', 'PS / TS and PED category'),
      why: tr('Výrobce navrhuje tloušťky, materiály a posouzení shody podle nejvyššího dovoleného tlaku PS, teplot TS a skupiny tekutiny.', 'The manufacturer designs wall thicknesses, materials and conformity assessment from the maximum allowable pressure PS, temperatures TS and the fluid group.'),
      fields: [
        todo('ped.ps', tr('PS – nejvyšší dovolený tlak', 'PS – maximum allowable pressure'), tr('Nejméně nastavení pojistného ventilu zdroje; u čerpadla jeho uzavírací tlak.', 'At least the relief valve setting of the source; with a pump its shut-off pressure.')),
        field(
          'ped.ts',
          tr('TS – rozsah teplot', 'TS – temperature range'),
          tr(
            `min. ${T(tsMin)} (kryogenní služba vzdušných plynů${tsMin < -196 ? '; kapalina chladnější než −196 °C' : ''}) / max. dle okolí – potvrď`,
            `min. ${T(tsMin)} (cryogenic air-gas service${tsMin < -196 ? '; liquid colder than −196 °C' : ''}) / max. per ambient – confirm`,
          ),
          'PRAXE',
          true,
        ),
        field(
          'ped.group',
          tr('Skupina tekutiny dle PED 2014/68/EU', 'Fluid group per PED 2014/68/EU'),
          isO2 ? tr('skupina 1 (kyslík – oxidující plyn)', 'group 1 (oxygen – oxidising gas)') : tr(`skupina 2 (${pol.name_cs})`, `group 2 (${pol.name_en})`),
          'PRAXE',
          true,
        ),
        field('ped.category', tr('Kategorie PED', 'PED category'), tr('stanoví výrobce dle PS a objemu / DN', 'determined by the manufacturer from PS and volume / DN'), 'PRAXE'),
        field(
          'ped.national',
          tr('Vyhrazené tlakové zařízení', 'Designated pressure equipment (CZ)'),
          tr('požadujeme posouzení a podklady dle zákona č. 250/2021 Sb. a NV č. 191/2022 Sb. (ověř aktuální znění); revize a zkoušky zůstávají povinností provozovatele', 'assessment and documents required per Czech Act No. 250/2021 Coll. and Gov. Decree No. 191/2022 Coll. (verify the current wording); inspections and tests remain the operator’s duty'),
          'PRAXE',
          false,
          { multiline: true },
        ),
      ],
    },
    {
      id: 'connections',
      title: tr('Připojení', 'Connections'),
      why: tr('Rozměry a druh připojení určují napojení na stávající potrubí a materiál prvního úseku.', 'Sizes and type of connections determine the tie-in to the existing piping and the material of the first section.'),
      fields: [
        todo('conn.inlet', tr('Vstup (DN, PN, druh: příruba / návarek)', 'Inlet (DN, PN, type: flange / weld end)'), ''),
        todo('conn.outlet', tr('Výstup (DN, PN, druh)', 'Outlet (DN, PN, type)'), ''),
        field('conn.pipe', tr('Min. návrhová teplota navazujícího potrubí', 'Min. design temperature of downstream piping'), T(inp.T_pipe_min_C), 'VSTUP', true),
        todo('conn.material', tr('Materiál výstupu a přechod Al / nerez', 'Outlet material and Al / stainless transition'), tr('Např. výstupní kolektor z nerezu, přechodový kus Al–nerez.', 'E.g. stainless outlet header, Al–stainless transition piece.')),
      ],
    },
    {
      id: 'relief',
      title: tr('Ochrana proti přetlaku uzavřených úseků', 'Overpressure protection of trapped sections'),
      why:
        tr('Kapalina nebo studený plyn uzavřený mezi armaturami se ohřívá a tlak roste nad PS – typicky v odstavené přepínané ', 'Liquid or cold gas trapped between valves warms up and the pressure rises above PS – typically in an idle switched ') +
        tr('větvi, za armaturou TSL po jejím zavření a v dohřevu.', 'branch, downstream of the TSL valve after it closes and in the trim heater.'),
      fields: [
        field(
          'relief.req',
          tr('Pojistné ventily', 'Relief valves'),
          tr('tepelné pojistné ventily na každém úseku, kde může zůstat uzavřená kapalina (odstavená větev, úsek za armaturou TSL, dohřev); odvod z pojistných ventilů na bezpečné místo', 'thermal relief valves on every section where liquid can be trapped (idle branch, section downstream of the TSL valve, trim heater); relief discharge to a safe location'),
          'PRAXE',
          false,
          { multiline: true },
        ),
      ],
    },
    {
      id: 'dp',
      title: tr('Max. tlaková ztráta', 'Max. pressure drop'),
      why: tr('Výrobce podle ní volí počet průchodů a průřez; tlaková ztráta snižuje tlak za odpařovačem (na výkon má malý vliv: 0,5 bar ≈ +0,05 až +0,15 %).', 'The manufacturer chooses the number of passes and the cross-section from it; the pressure drop lowers the pressure downstream (small effect on duty: 0.5 bar ≈ +0.05 to +0.15 %).'),
      fields: [todo('dp.max', tr('Max. tlaková ztráta při špičkovém průtoku', 'Max. pressure drop at peak flow'), 'bar')],
    },
    {
      id: 'guarantee',
      title: tr('Garanční podmínky', 'Guarantee conditions'),
      why:
        tr('Kapacitu v Nm³/h výrobce garantuje jen za definovaných podmínek. Bez nich nejsou nabídky srovnatelné a katalogová ', 'The manufacturer guarantees the capacity in Nm³/h only under defined conditions. Without them offers are not comparable and the catalogue ') +
        tr('kapacita se nedá přepočíst na lokalitu.', 'capacity cannot be re-rated to the site.'),
      fields: [
        field('guar.peak', tr('Garantovaný průtok (na jednu provozní větev)', 'Guaranteed flow (per operating branch)'), flowPeak, 'VSTUP', true),
        field('guar.avg', tr('Průměrný průtok', 'Average flow'), flowAvg, 'VSTUP', true),
        field('guar.tout', tr('Výstupní teplota plynu na konci provozního cyklu', 'Gas outlet temperature at the end of the operating cycle'), `≥ ${T(inp.T_out_C)}`, 'VSTUP', true),
        field(
          'guar.tmin',
          tr('Minimální teplota okolí lokality', 'Minimum ambient temperature of the site'),
          inp.T_min_site_C !== null ? T(inp.T_min_site_C) : tr('nezadáno – doplň', 'not set – fill in'),
          'VSTUP',
          true,
        ),
        field('guar.rh', tr('Relativní vlhkost v zimě', 'Relative humidity in winter'), `${fmt(inp.RH_winter_pct, 0)} %`, 'VSTUP', true),
        todo('guar.wind', tr('Vítr / proudění vzduchu u jednotky', 'Wind / air flow at the unit'), tr('Např. bezvětří, umístění u budovy.', 'E.g. calm, located next to a building.')),
        field('guar.profile', tr('Profil provozu', 'Operating profile'), profile, 'VSTUP', true),
        field(
          'guar.frost',
          tr('Délka mrazového období', 'Length of the frost period'),
          inp.frostWeeks !== null ? tr(`${fmt(inp.frostWeeks, 0)} týdnů`, `${fmt(inp.frostWeeks, 0)} weeks`) : tr('nezadáno – doplň', 'not set – fill in'),
          'VSTUP',
          true,
        ),
        field('guar.start', tr('Start', 'Start'), tr('z odmraženého stavu; garance platí do konce provozního cyklu', 'from the defrosted state; guarantee valid until the end of the operating cycle'), 'PRAXE'),
        cycle !== null
          ? field('guar.cycle', tr('Délka provozního cyklu', 'Operating cycle length'), tr(`${cycle} od startu z odmraženého stavu`, `${cycle} from a defrosted start`), 'VSTUP', true)
          : todo('guar.cycle', tr('Délka provozního cyklu / interval přepnutí větví', 'Operating cycle length / branch switching interval'), tr('Např. časovač 6 h; při 24/7 rozhoduje o garanci.', 'E.g. 6 h timer; with 24/7 it decides the guarantee.')),
        todo('guar.peaks', tr('Trvání a četnost špiček', 'Duration and frequency of peaks'), tr('Např. 2 h špička 1× denně, jinak průměr.', 'E.g. 2 h peak once a day, otherwise average.')),
        field('guar.sentence', tr('Garanční věta (souhrn)', 'Guarantee statement (summary)'), guarantee, 'VSTUP', true, { multiline: true }),
        field(
          'guar.info',
          tr('Informativně z výpočtu', 'For information, from the calculation'),
          d
            ? tr(`tepelná potřeba Q = ${fmt(d.Q_kW, 1)} kW`, `heat duty Q = ${fmt(d.Q_kW, 1)} kW`) +
                (sizing
                  ? tr(
                      `; ideální dolní mez (model konst. U, ${basis?.name ?? 'katalogový základ'}) ${fmt(sizing.N_eq_Nm3_h, 0)} Nm³/h, nejmenší kapacita větve ${fmt(sizing.minBranchCapacity_Nm3_h, 0)} Nm³/h – požadujeme přepočet výrobce na lokalitu`,
                      `; ideal lower bound (constant-U model, ${basis?.name ?? 'catalogue basis'}) ${fmt(sizing.N_eq_Nm3_h, 0)} Nm³/h, minimum branch capacity ${fmt(sizing.minBranchCapacity_Nm3_h, 0)} Nm³/h – we require the manufacturer's re-rating to the site`,
                    )
                  : '')
            : '',
          'VYPOCET',
          true,
          { multiline: true },
        ),
      ],
    },
    {
      id: 'protection',
      title: tr('Rozsah dodávky ochran', 'Scope of supply of protections'),
      why:
        tr('Ochrana při nízké výstupní teplotě (TSL) chrání navazující potrubí před křehkým lomem (AIGA 027). Musí být jasné, kdo ', 'The low outlet temperature protection (TSL) protects the downstream piping against brittle fracture (AIGA 027). It must be clear who ') +
        tr('dodává čidlo, armaturu a logiku a s jakou spolehlivostí.', 'supplies the sensor, valve and logic, and with what reliability.'),
      fields: [
        field('prot.tsl', tr('Nastavení TSL', 'TSL setting'), inp.TSL_C !== null ? T(inp.TSL_C) : tr('nezadáno – doplň', 'not set – fill in'), 'VSTUP', true),
        field('prot.margin', tr('Požadovaná rezerva T_out nad TSL', 'Required margin of T_out above TSL'), `${fmt(inp.TSL_margin_K, 0)} K`, 'VSTUP', true),
        field('prot.scope', tr('Rozsah', 'Scope'), tr('teplotní čidlo na výstupu + uzavírací armatura fail-close na přívodu kapaliny', 'outlet temperature sensor + fail-close shut-off valve on the liquid supply'), 'PRAXE'),
        todo('prot.sil', tr('Požadovaná úroveň SIL', 'Required SIL'), tr('Dle analýzy rizik (HAZOP / LOPA).', 'Per the risk analysis (HAZOP / LOPA).')),
        field('prot.reset', tr('Reset po vypnutí', 'Reset after trip'), tr('ruční reset na místě', 'manual local reset'), 'PRAXE'),
        field(
          'prot.req',
          tr('Požadavky na TSL', 'Requirements on TSL'),
          tr('nezávislé na řízení přepínání; uvést dobu odezvy čidla a dobu zavření armatury; bezpečný stav při ztrátě energie / vzduchu; interval periodických zkoušek celé smyčky; řízení přemostění (bypass)', 'independent of the switching control; state sensor response and valve closing time; safe state on loss of power / air; proof-test interval of the whole loop; bypass management'),
          'PRAXE',
          false,
          { multiline: true },
        ),
      ],
    },
    {
      id: 'switching',
      title: tr('Přepínací armatury', 'Switching valves'),
      why: tr('Při nepřetržitém provozu se větve střídají, aby odstavená větev odtála. Přepínání nenahrazuje TSL.', 'In continuous operation the branches alternate so that the idle one defrosts. Switching does not replace TSL.'),
      fields: [
        field(
          'sw.scope',
          tr('Přepínání větví', 'Branch switching'),
          switched
            ? tr('požadováno – automatické přepínání (časovač 4–8 h + přepnutí při nízké výstupní teplotě)', 'required – automatic switching (timer 4–8 h + switchover on low outlet temperature)')
            : tr('nepožadováno (jedna větev) – případně nabídni jako opci', 'not required (single branch) – offer as an option if appropriate'),
          'PRAXE',
          true,
        ),
      ],
    },
    {
      id: 'loads',
      title: tr('Zatížení větrem, sněhem a ledem', 'Wind, snow and ice loads'),
      why: tr('Námraza na konci cyklu může vážit tuny; výrobce ji musí zahrnout do statiky, kotvení a podkladu.', 'Frost at the end of the cycle can weigh tonnes; the manufacturer must include it in the structural design, anchoring and foundation.'),
      fields: [
        todo('loads.wind', tr('Větrná oblast (ČSN EN 1991-1-4)', 'Wind zone (EN 1991-1-4)'), ''),
        todo('loads.snow', tr('Sněhová oblast (ČSN EN 1991-1-3)', 'Snow zone (EN 1991-1-3)'), ''),
        field('loads.ice', tr('Námraza', 'Frost'), tr('hmotnost námrazy na konci cyklu zahrnout do statiky a kotvení', 'include the frost mass at the end of the cycle in structural design and anchoring'), 'PRAXE'),
      ],
    },
    {
      id: 'cleanliness',
      title: isO2 ? tr('Kyslíková čistota', 'Oxygen cleanliness') : tr('Čistota', 'Cleanliness'),
      why: isO2
        ? tr('Nečistoty a nevhodné materiály v kyslíku mohou vést k zapálení. Čištění a materiály musí odpovídat kyslíkové službě.', 'Contamination and unsuitable materials in oxygen can lead to ignition. Cleaning and materials must suit oxygen service.')
        : tr('Dusík není oxidující; stačí běžná čistota pro kryogenní službu.', 'The fluid is not oxidising; normal cleanliness for cryogenic service is sufficient.'),
      fields: [
        field(
          'clean.req',
          tr('Požadavek', 'Requirement'),
          isO2
            ? tr('čištění pro kyslíkovou službu dle EIGA Doc 33 / EN 12300, materiály a těsnění kompatibilní s kyslíkem, certifikát čistoty', 'cleaning for oxygen service per EIGA Doc 33 / EN 12300, oxygen-compatible materials and seals, cleanliness certificate')
            : tr('běžná čistota pro kryogenní službu', 'normal cleanliness for cryogenic service'),
          'PRAXE',
          true,
          { multiline: true },
        ),
        ...(isO2
          ? [
              field(
                'clean.valves',
                tr('Armatury pro kyslík', 'Valves for oxygen'),
                tr('materiály a konstrukce odolné vůči zapálení (adiabatická komprese u rychle otevíraných / přepínacích armatur), rychlosti proudění dle EIGA Doc 13', 'ignition-resistant materials and design (adiabatic compression in fast-opening / switching valves), flow velocities per EIGA Doc 13'),
                'PRAXE',
                false,
                { multiline: true },
              ),
            ]
          : []),
      ],
    },
    {
      id: 'install',
      title: tr('Odmrazování, zkoušky a stav při dodání', 'Defrosting, tests and condition on delivery'),
      why: tr('Určuje provoz v zimě, přejímku a bezpečné uvedení do provozu.', 'Determines winter operation, acceptance and safe commissioning.'),
      fields: [
        todo('inst.defrost', tr('Způsob odmrazování', 'Defrosting method'), tr('Přirozeně / vodou / ohřátým plynem; postup s odstavením a zajištěním.', 'Natural / with water / with warm gas; procedure with isolation and lock-out.')),
        field('inst.tests', tr('Zkoušky u výrobce', 'Factory tests'), tr('tlaková a těsnostní zkouška s protokolem', 'pressure and leak test with certificate'), 'PRAXE'),
        field('inst.delivery', tr('Stav při dodání', 'Condition on delivery'), tr('vysušeno, uzavřeno a natlakováno suchým dusíkem', 'dried, sealed and pressurised with dry nitrogen'), 'PRAXE'),
        ...(isO2 ? [field('inst.ground', tr('Podklad', 'Ground'), tr('bez asfaltu a hořlavých materiálů pod zařízením a v okolí (kapalný kyslík)', 'no asphalt or combustible materials under and around the equipment (liquid oxygen)'), 'PRAXE')] : []),
      ],
    },
    {
      id: 'docs',
      title: tr('Dokumenty', 'Documents'),
      why: tr('Dokumentace je podmínkou uvedení do provozu, revizí a údržby.', 'Documentation is a prerequisite for commissioning, inspections and maintenance.'),
      fields: [
        field(
          'docs.list',
          tr('Požadované dokumenty', 'Required documents'),
          [
            tr('materiálové atesty EN 10204 3.1', 'material certificates EN 10204 3.1'),
            isO2 ? tr('certifikát čištění pro kyslíkovou službu', 'cleaning certificate for oxygen service') : null,
            tr('prohlášení o shodě (PED)', 'declaration of conformity (PED)'),
            tr('návod k obsluze a postup odmrazování v češtině', 'operating manual and defrosting procedure in Czech'),
            tr('seznam náhradních dílů', 'spare parts list'),
          ]
            .filter(Boolean)
            .join('; '),
          'PRAXE',
          true,
          { multiline: true },
        ),
      ],
    },
  ];
}

const normalize = (s: string) =>
  s
    .replace(/−/g, '-')
    .replace(/[\s  ]+/g, ' ')
    .trim()
    .toLowerCase();

export function fieldValue(f: InquiryField, overrides: InquiryOverrides): string {
  return overrides[f.key] ?? f.prefill;
}

export interface InquiryMismatch {
  key: string;
  label: string;
  expected: string;
  actual: string;
}

/** Kontrola, že formulář odpovídá vstupům výpočtu: svázaná pole přepsaná jinak než podle vstupů. */
export function checkInquiry(items: readonly InquiryItem[], overrides: InquiryOverrides): InquiryMismatch[] {
  const out: InquiryMismatch[] = [];
  for (const it of items)
    for (const f of it.fields) {
      const o = overrides[f.key];
      if (f.linked && o !== undefined && normalize(o) !== normalize(f.prefill))
        out.push({ key: f.key, label: `${it.title} – ${f.label}`, expected: f.prefill, actual: o });
    }
  return out;
}

/** Pole k doplnění, která jsou stále prázdná. */
export function missingInquiryFields(items: readonly InquiryItem[], overrides: InquiryOverrides): string[] {
  return items.flatMap((it) =>
    it.fields.filter((f) => f.source === 'DOPLNIT' && fieldValue(f, overrides).trim() === '').map((f) => `${it.title} – ${f.label}`),
  );
}
