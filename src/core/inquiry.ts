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
      ? 'nasycená kapalina při provozním tlaku'
      : `podchlazená kapalina ${T(inp.liquid.T_C, 1)}`;
  const flowPeak = `${fmt(toNm3h(inp.flow), 0)} Nm³/h (špička)`;
  const flowAvg = inp.avgFlow ? `${fmt(toNm3h(inp.avgFlow), 0)} Nm³/h` : 'nezadáno';
  const profile = inp.continuous24_7 ? 'nepřetržitě 24/7' : `${fmt(inp.hoursPerDay, 0)} h/den s odstávkou`;
  const switched = ev.concept?.items.some((i) => i.id === 'SWITCHED' && i.role === 'doporučeno') ?? false;
  const nPlus1 = inp.availability === 'N+1';
  const sizing = ev.sizing?.ok ? ev.sizing : null;

  return [
    {
      id: 'project',
      title: 'Identifikace a rozsah',
      why: 'Lokalita určuje klimatická data a zatížení konstrukce; počet větví a termín určují nabídku a výrobní kapacitu.',
      fields: [
        todo('project.site', 'Lokalita (adresa, nadmořská výška)', 'Výrobce z ní přepočítává kapacitu na místní klima.'),
        todo('project.contact', 'Zákazník / kontaktní osoba', ''),
        todo('project.deadline', 'Požadovaný termín dodávky', ''),
        field(
          'project.branches',
          'Počet provozních větví',
          `${switched ? '2 přepínané provozní větve' : '1 provozní větev'}${nPlus1 ? ' + 1 záložní větev (N+1)' : ''}`,
          'PRAXE',
          true,
        ),
      ],
    },
    {
      id: 'source',
      title: 'Zdroj kapaliny',
      why: 'Teplota a tlak kapaliny určují teplo na ohřev a var; zdroj (nádrž, čerpadlo) mění podchlazení a kolísání tlaku.',
      fields: [
        field('source.fluid', 'Médium', `${pol.liquidLabel} – ${pol.name_cs} (${pol.formula})`, 'VSTUP', true),
        field('source.liquid', 'Stav kapaliny na vstupu', liquid, 'VSTUP', true),
        field('source.pressure', 'Provozní tlak', pressure, 'VSTUP', true),
        todo('source.tank', 'Zdroj (nádrž, objem, pojistný tlak, čerpadlo ano/ne)', 'Např. zásobník 30 m³, pojistný ventil 18 bar, bez čerpadla.', true),
      ],
    },
    {
      id: 'ped',
      title: 'PS / TS a kategorie PED',
      why: 'Výrobce navrhuje tloušťky, materiály a posouzení shody podle nejvyššího dovoleného tlaku PS, teplot TS a skupiny tekutiny.',
      fields: [
        todo('ped.ps', 'PS – nejvyšší dovolený tlak', 'Nejméně nastavení pojistného ventilu zdroje.'),
        field('ped.ts', 'TS – rozsah teplot', 'min. −196 °C (kryogenní služba vzdušných plynů) / max. dle okolí – potvrď', 'PRAXE'),
        field(
          'ped.group',
          'Skupina tekutiny dle PED 2014/68/EU',
          isO2 ? 'skupina 1 (kyslík – oxidující plyn)' : `skupina 2 (${pol.name_cs})`,
          'PRAXE',
          true,
        ),
        field('ped.category', 'Kategorie PED', 'stanoví výrobce dle PS a objemu / DN', 'PRAXE'),
        field('ped.national', 'Vyhrazené tlakové zařízení', 'požadujeme posouzení a podklady dle platné legislativy ČR', 'PRAXE'),
      ],
    },
    {
      id: 'connections',
      title: 'Připojení',
      why: 'Rozměry a druh připojení určují napojení na stávající potrubí a materiál prvního úseku.',
      fields: [
        todo('conn.inlet', 'Vstup (DN, PN, druh: příruba / návarek)', ''),
        todo('conn.outlet', 'Výstup (DN, PN, druh)', ''),
        field('conn.pipe', 'Min. návrhová teplota navazujícího potrubí', T(inp.T_pipe_min_C), 'VSTUP', true),
      ],
    },
    {
      id: 'dp',
      title: 'Max. tlaková ztráta',
      why: 'Výrobce podle ní volí počet průchodů a průřez; tlaková ztráta snižuje tlak za odpařovačem (na výkon má malý vliv: 0,5 bar ≈ +0,05 %).',
      fields: [todo('dp.max', 'Max. tlaková ztráta při špičkovém průtoku', 'bar')],
    },
    {
      id: 'guarantee',
      title: 'Garanční podmínky',
      why:
        'Kapacitu v Nm³/h výrobce garantuje jen za definovaných podmínek. Bez nich nejsou nabídky srovnatelné a katalogová ' +
        'kapacita se nedá přepočíst na lokalitu.',
      fields: [
        field('guar.peak', 'Garantovaný průtok', flowPeak, 'VSTUP', true),
        field('guar.avg', 'Průměrný průtok', flowAvg, 'VSTUP', true),
        field('guar.tout', 'Výstupní teplota plynu na konci provozního cyklu', `≥ ${T(inp.T_out_C)}`, 'VSTUP', true),
        field(
          'guar.tmin',
          'Minimální teplota okolí lokality',
          inp.T_min_site_C !== null ? T(inp.T_min_site_C) : 'nezadáno – doplň',
          'VSTUP',
          true,
        ),
        field('guar.rh', 'Relativní vlhkost v zimě', `${fmt(inp.RH_winter_pct, 0)} %`, 'VSTUP', true),
        todo('guar.wind', 'Vítr / proudění vzduchu u jednotky', 'Např. bezvětří, umístění u budovy.'),
        field('guar.profile', 'Profil provozu', profile, 'VSTUP', true),
        field(
          'guar.frost',
          'Délka mrazového období',
          inp.frostWeeks !== null ? `${fmt(inp.frostWeeks, 0)} týdnů` : 'nezadáno – doplň',
          'VSTUP',
          true,
        ),
        field('guar.start', 'Start', 'z odmraženého stavu; garance platí do konce provozního cyklu', 'PRAXE'),
        field(
          'guar.info',
          'Informativně z výpočtu',
          d
            ? `tepelná potřeba Q = ${fmt(d.Q_kW, 1)} kW` +
                (sizing
                  ? `; ideální dolní mez (model konst. U, ${basis?.name ?? 'katalogový základ'}) ${fmt(sizing.N_eq_Nm3_h, 0)} Nm³/h, ` +
                    `nejmenší kapacita větve ${fmt(sizing.minBranchCapacity_Nm3_h, 0)} Nm³/h – požadujeme přepočet výrobce na lokalitu`
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
      title: 'Rozsah dodávky ochran',
      why:
        'Ochrana při nízké výstupní teplotě (TSL) chrání navazující potrubí před křehkým lomem (AIGA 027). Musí být jasné, kdo ' +
        'dodává čidlo, armaturu a logiku a s jakou spolehlivostí.',
      fields: [
        field('prot.tsl', 'Nastavení TSL', inp.TSL_C !== null ? T(inp.TSL_C) : 'nezadáno – doplň', 'VSTUP', true),
        field('prot.margin', 'Požadovaná rezerva T_out nad TSL', `${fmt(inp.TSL_margin_K, 0)} K`, 'VSTUP', true),
        field('prot.scope', 'Rozsah', 'teplotní čidlo na výstupu + uzavírací armatura fail-close na přívodu kapaliny', 'PRAXE'),
        todo('prot.sil', 'Požadovaná úroveň SIL', 'Dle analýzy rizik (HAZOP / LOPA).'),
        field('prot.reset', 'Reset po vypnutí', 'ruční reset na místě', 'PRAXE'),
      ],
    },
    {
      id: 'switching',
      title: 'Přepínací armatury',
      why: 'Při nepřetržitém provozu se větve střídají, aby odstavená větev odtála. Přepínání nenahrazuje TSL.',
      fields: [
        field(
          'sw.scope',
          'Přepínání větví',
          switched
            ? 'požadováno – automatické přepínání (časovač 4–8 h + přepnutí při nízké výstupní teplotě)'
            : 'nepožadováno (jedna větev) – případně nabídni jako opci',
          'PRAXE',
          true,
        ),
      ],
    },
    {
      id: 'loads',
      title: 'Zatížení větrem, sněhem a ledem',
      why: 'Námraza na konci cyklu může vážit tuny; výrobce ji musí zahrnout do statiky, kotvení a podkladu.',
      fields: [
        todo('loads.wind', 'Větrná oblast (ČSN EN 1991-1-4)', ''),
        todo('loads.snow', 'Sněhová oblast (ČSN EN 1991-1-3)', ''),
        field('loads.ice', 'Námraza', 'hmotnost námrazy na konci cyklu zahrnout do statiky a kotvení', 'PRAXE'),
      ],
    },
    {
      id: 'cleanliness',
      title: isO2 ? 'Kyslíková čistota' : 'Čistota',
      why: isO2
        ? 'Nečistoty a nevhodné materiály v kyslíku mohou vést k zapálení. Čištění a materiály musí odpovídat kyslíkové službě.'
        : 'Dusík není oxidující; stačí běžná čistota pro kryogenní službu.',
      fields: [
        field(
          'clean.req',
          'Požadavek',
          isO2
            ? 'čištění pro kyslíkovou službu dle EIGA Doc 33 / EN 12300, materiály a těsnění kompatibilní s kyslíkem, certifikát čistoty'
            : 'běžná čistota pro kryogenní službu',
          'PRAXE',
          true,
          { multiline: true },
        ),
      ],
    },
    {
      id: 'docs',
      title: 'Dokumenty',
      why: 'Dokumentace je podmínkou uvedení do provozu, revizí a údržby.',
      fields: [
        field(
          'docs.list',
          'Požadované dokumenty',
          [
            'materiálové atesty EN 10204 3.1',
            isO2 ? 'certifikát čištění pro kyslíkovou službu' : null,
            'prohlášení o shodě (PED)',
            'návod k obsluze a postup odmrazování v češtině',
            'seznam náhradních dílů',
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
