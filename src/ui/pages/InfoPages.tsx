/** Stránky: Postup návrhu (10 kroků), Rovnice a předpoklady, Zdroje. */
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { FLUID_POLICY } from '../../core/fluids';
import { buildInquiry, checkInquiry, missingInquiryFields } from '../../core/inquiry';
import type { FluidId } from '../../core/properties/types';
import { guideSteps, type PageId } from '../content/guide';
import { getLang, tr } from '../../core/i18n';

type StepState = { kind: 'ok' | 'warn' | 'todo'; text: string } | null;

/** Stav kroků 1–6 odvozený z aktuálního případu (ostatní kroky jsou mimo aplikaci). */
function stepStates(ev: Evaluation, inquiry: Record<string, string>, basis: CatalogBasis | undefined): Record<string, StepState> {
  const lv = (id: string) => ev.checks.find((c) => c.id === id)?.level;
  const anyBad = (ids: string[]) => ids.some((id) => lv(id) === 'CHYBA');
  const anyWarn = (ids: string[]) => ids.some((id) => lv(id) === 'POZOR');
  const items = buildInquiry(ev, basis);
  const mism = checkInquiry(items, inquiry).length;
  const missing = missingInquiryFields(items, inquiry).length;
  const ok = (text: string): StepState => ({ kind: 'ok', text });
  const warn = (text: string): StepState => ({ kind: 'warn', text });
  const todo = (text: string): StepState => ({ kind: 'todo', text });
  return {
    '1':
      lv('K1') === 'CHYBA'
        ? warn(tr('zkontroluj vstupy (K1)', 'check the inputs (K1)'))
        : ev.input.avgFlow
          ? ok(tr('zadáno', 'entered'))
          : todo(tr('chybí průměrný průtok (pro poptávku)', 'average flow missing (for the enquiry)')),
    '2': anyBad(['K2', 'K3', 'K4', 'K5', 'K6', 'K8'])
      ? warn(tr('CHYBA v kontrolách', 'ERROR in the checks'))
      : anyWarn(['K4', 'K6', 'K8'])
        ? warn(tr('viz POZOR', 'see WARNING'))
        : ev.input.TSL_C === null
          ? todo(tr('chybí TSL', 'TSL missing'))
          : ok(tr('v pořádku', 'OK')),
    '3': ev.input.T_min_site_C === null
      ? todo(tr('chybí min. teplota lokality', 'minimum site temperature missing'))
      : ev.input.frostWeeks === null
        ? todo(tr('chybí délka mrazového období', 'frost period length missing'))
        : ok(tr('zadáno', 'entered')),
    '4': ev.duty ? (ev.status === 'ALL_OK' ? ok(ev.statusText) : warn(ev.statusText)) : warn(tr('výkon nelze spočítat', 'duty cannot be calculated')),
    '5': ev.concept && ev.sizing?.ok
      ? ok(tr('koncept a dolní mez k dispozici', 'concept and lower bound available'))
      : ev.concept
        ? warn(tr('posouzení velikosti nelze', 'size assessment not possible'))
        : warn(tr('nejdřív oprav vstupy', 'correct the inputs first')),
    '6': mism
      ? warn(tr(`poptávka se liší od vstupů v ${mism} polích`, `enquiry differs from inputs in ${mism} fields`))
      : missing
        ? todo(tr(`k doplnění ${missing} polí`, `${missing} fields to fill in`))
        : ok(tr('vyplněno', 'complete')),
  };
}

export function GuidePage({
  fluid,
  go,
  ev,
  inquiry,
  basis,
}: {
  fluid: FluidId;
  go: (p: PageId, anchor?: string) => void;
  ev?: Evaluation;
  inquiry?: Record<string, string>;
  basis?: CatalogBasis;
}) {
  const steps = guideSteps(fluid);
  const states = ev ? stepStates(ev, inquiry ?? {}, basis) : {};
  return (
    <div className="info-page">
      <section className="card">
        <h2>{tr('Postup návrhu v 10 krocích', 'Design procedure in 10 steps')}</h2>
        <p className="note">
          {tr(
            `Průvodce návrhem nového odpařovače. Krok 8 se řídí zvolenou látkou (${FLUID_POLICY[fluid].formula}). Ke každému kroku: co udělat, vstupy, výstupy a typická chyba.`,
            `A guide to designing a new vaporizer. Step 8 follows the selected fluid (${FLUID_POLICY[fluid].formula}). For each step: what to do, inputs, outputs and a typical mistake.`,
          )}
        </p>
      </section>
      <ol className="guide">
        {steps.map((s) => (
          <li key={s.n} className="card guide-step">
            <h3>
              <span className="step-no">{s.n}</span> {s.title}
              {states[s.n] ? (
                <span className={`step-state st-${states[s.n]!.kind}`} data-testid={`step-state-${s.n}`}>
                  {states[s.n]!.kind === 'ok' ? '✓' : states[s.n]!.kind === 'warn' ? '!' : '…'} {states[s.n]!.text}
                </span>
              ) : null}
            </h3>
            <ul>
              {s.todo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <dl className="guide-dl">
              <dt>{tr('Vstupy', 'Inputs')}</dt>
              <dd>{s.inputs}</dd>
              <dt>{tr('Výstupy', 'Outputs')}</dt>
              <dd>{s.outputs}</dd>
              <dt>{tr('Typická chyba', 'Typical mistake')}</dt>
              <dd className="mistake">
                <span className="mistake-label">{tr('pozor: ', 'caution: ')}</span>
                {s.mistake}
              </dd>
            </dl>
            {s.link ? (
              <button type="button" className="link-btn" onClick={() => go(s.link!.page, s.link!.anchor)}>
                → {s.link.label}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

const EQUATIONS_CS: readonly { title: string; eq: string[]; notes: string[] }[] = [
  {
    title: '5.1 Hmotnostní průtok',
    eq: ['ρn = ρ(látka; 0 °C; 1,01325 bar) – reálný plyn ze stavové rovnice', 'ṁ [kg/s] = V̇n [Nm³/h] · ρn / 3600'],
    notes: ['O₂: ρn = 1,42903 kg/Nm³; N₂: ρn = 1,25039 kg/Nm³; Ar: ρn = 1,78396 kg/Nm³.'],
  },
  {
    title: '5.2 Energetická bilance',
    eq: [
      'Q = ṁ · (h_out − h_in),  h_out = h(p, T_out),  h_in = h_l,sat(p) nebo h_l(p, T_in)',
      'q₁ = h_l,sat(p) − h_in;  q₂ = r(p) = h_v,sat(p) − h_l,sat(p);  q₃ = h_out − h_v,sat(p)',
      'Q_I = ṁ(q₁ + q₂) zóna varu;  Q_II = ṁ·q₃ zóna přehřátí',
      'c_p,l = q₁/(T_sat − T_in) jen při |T_sat − T_in| ≥ 1 K;  c_p,g = q₃/(T_out − T_sat)',
    ],
    notes: [
      'Ustálený otevřený systém, bez práce, změny kinetické a potenciální energie zanedbány.',
      'p je absolutní tlak; tlaková ztráta zanedbána – 0,5 bar by zvýšila Q o +0,05 % ve výchozím případu (O₂ +0,051 %, N₂ +0,046 %, Ar +0,057 %), při 30–40 bar a a T_out −60 °C až o +0,15 % (nezávislá kontrola).',
      'Referenční stav: h = 0 pro nasycenou kapalinu při 1,01325 bar (na výsledek nemá vliv).',
    ],
  },
  {
    title: '5.3 Spotřeba a dohřev',
    eq: ['m = ṁ·t;  V = m / ρ_in', 'Q_dohřev = ṁ · (h(p, T_out) − h(p, T_skut)) pro T_skut < T_out'],
    notes: [],
  },
  {
    title: '5.4 Relativní velikost – ideální dolní mez (model konstantního U)',
    eq: [
      'T_des = MIN(T_okolí, T_min,lokality)',
      'ΔT_I = T_des − T_sat (konzervativně celá zóna I při T_sat);  ΔT_out = T_des − T_out > 0',
      'LMTD_II = (ΔT_I − ΔT_out) / ln(ΔT_I / ΔT_out)',
      'UA_potř = Q_I/ΔT_I + Q_II/LMTD_II',
      'UA₁ = totéž pro 1 Nm³/h nasycené kapaliny při katalogovém tlaku, T_okolí,kat a T_out,kat = T_okolí,kat − přiblížení',
      'N_eq = UA_potř / UA₁;  tepelná náročnost = N_eq·k / V̇n;  nejmenší kapacita větve = MAX(V̇n; N_eq·k)',
    ],
    notes: [
      'Model předpokládá stejné U jako při katalogových podmínkách. V mrazu to neplatí (námraza, chybějící latentní teplo, studený vzduch u jednotky) – tyto vlivy převládají, výsledek je OPTIMISTICKÝ.',
      'LMTD s konstantním c_p nadhodnocuje UA_II v potřebě i v UA₁; v poměru N_eq se chyba částečně ruší: pod ~14 bar a je N_eq o 1,5–4,5 % nižší (optimistické), při 30–40 bar a o 6–14 % vyšší (nezávislá kontrola integrací přes h(T)).',
      'UA₁ předpokládá nasycenou kapalinu při katalogovém tlaku – konzervativní volba (kapalina na bodu varu by dala UA₁ asi o 10 % vyšší).',
      'Nejmenší kapacita větve je dolní hranice pro poptávku, nikdy doporučený model.',
    ],
  },
  {
    title: '5.5 Psychrometrie (vysvětlující model)',
    eq: [
      'x [g/kg] = 622·φ·e_s / (p − φ·e_s),  p = 1013,25 hPa',
      'nad vodou (T ≥ 0 °C): e_s = 6,112·exp(17,62·T/(243,12 + T)) hPa',
      'nad ledem (T < 0 °C): e_s = 6,112·exp(22,46·T/(272,62 + T)) hPa',
    ],
    notes: [
      'Latentní potenciál ~2,8 kJ na 1 g vymrzlé vody.',
      'Předepsaný vzorec dává pro 20 °C / 75 % hodnotu 10,93 g/kg.',
      'Pod 0 °C je RH vztažená k ledu (podle zadání); meteorologická RH se udává vůči vodě (−15 °C / 85 %: 1,00 místo 0,86 g/kg).',
    ],
  },
  {
    title: 'Vlastnosti látek',
    eq: ['Stavové rovnice: O₂ Schmidt & Wagner (1985), N₂ Span et al. (2000), Ar Tegeler et al. (1999) – přes CoolProp 7.2.0'],
    notes: [
      'Tabulky generované z CoolProp při buildu: nasycení podle tlaku, plyn h(p, T) −60 až +40 °C, kapalina h_l(T, Δp) s Δp = p − p_sat(T); lineární / bilineární interpolace.',
      'Doložená přesnost proti přímému CoolProp (3000 bodů na látku): výkon ≤ 0,1 % (skutečně ~0,02 %), T_sat ≤ 0,05 K.',
      'Mimo rozsah dat se nikdy neextrapoluje – výpočet se zablokuje s důvodem.',
      'Rozsah tlaku: O₂ 1–40 bar a, N₂ 1–32 bar a (kritický tlak N₂ 33,96 bar – nadkritický režim je samostatná úloha), Ar 1–40 bar a (kritický tlak 48,63 bar).',
      'Dolní mez tabulky kapaliny těsně nad trojným bodem: O₂ −218 °C, N₂ −209 °C, Ar −189 °C.',
    ],
  },
];

const EQUATIONS_EN: readonly { title: string; eq: string[]; notes: string[] }[] = [
  {
    title: '5.1 Mass flow',
    eq: ['ρn = ρ(fluid; 0 °C; 1.01325 bar) – real gas from the equation of state', 'ṁ [kg/s] = V̇n [Nm³/h] · ρn / 3600'],
    notes: ['O₂: ρn = 1.42903 kg/Nm³; N₂: ρn = 1.25039 kg/Nm³; Ar: ρn = 1.78396 kg/Nm³.'],
  },
  {
    title: '5.2 Energy balance',
    eq: [
      'Q = ṁ · (h_out − h_in),  h_out = h(p, T_out),  h_in = h_l,sat(p) or h_l(p, T_in)',
      'q₁ = h_l,sat(p) − h_in;  q₂ = r(p) = h_v,sat(p) − h_l,sat(p);  q₃ = h_out − h_v,sat(p)',
      'Q_I = ṁ(q₁ + q₂) boiling zone;  Q_II = ṁ·q₃ superheating zone',
      'c_p,l = q₁/(T_sat − T_in) only if |T_sat − T_in| ≥ 1 K;  c_p,g = q₃/(T_out − T_sat)',
    ],
    notes: [
      'Steady open system, no work, kinetic and potential energy changes neglected.',
      'p is absolute pressure; pressure drop neglected – 0.5 bar would raise Q by +0.05 % in the default case (O₂ +0.051 %, N₂ +0.046 %, Ar +0.057 %), at 30–40 bar a and T_out −60 °C by up to +0.15 % (independent review).',
      'Reference state: h = 0 for saturated liquid at 1.01325 bar (no effect on the result).',
    ],
  },
  {
    title: '5.3 Consumption and trim heating',
    eq: ['m = ṁ·t;  V = m / ρ_in', 'Q_trim = ṁ · (h(p, T_out) − h(p, T_act)) for T_act < T_out'],
    notes: [],
  },
  {
    title: '5.4 Relative size – ideal lower bound (constant-U model)',
    eq: [
      'T_des = MIN(T_amb, T_min,site)',
      'ΔT_I = T_des − T_sat (conservatively the whole zone I at T_sat);  ΔT_out = T_des − T_out > 0',
      'LMTD_II = (ΔT_I − ΔT_out) / ln(ΔT_I / ΔT_out)',
      'UA_req = Q_I/ΔT_I + Q_II/LMTD_II',
      'UA₁ = the same for 1 Nm³/h of saturated liquid at catalogue pressure, T_amb,cat and T_out,cat = T_amb,cat − approach',
      'N_eq = UA_req / UA₁;  thermal demand = N_eq·k / V̇n;  minimum branch capacity = MAX(V̇n; N_eq·k)',
    ],
    notes: [
      'The model assumes the same U as at catalogue conditions. In frost this does not hold (icing, missing latent heat, cold air around the unit) – these effects dominate, the result is OPTIMISTIC.',
      'LMTD with constant c_p overstates UA_II in both the requirement and UA₁; in the N_eq ratio the error partly cancels: below ~14 bar a N_eq is 1.5–4.5 % lower (optimistic), at 30–40 bar a 6–14 % higher (independent review by integration over h(T)).',
      'UA₁ assumes saturated liquid at catalogue pressure – a conservative choice (liquid at the normal boiling point would give UA₁ about 10 % higher).',
      'The minimum branch capacity is a lower bound for the enquiry, never a recommended model.',
    ],
  },
  {
    title: '5.5 Psychrometrics (explanatory model)',
    eq: [
      'x [g/kg] = 622·φ·e_s / (p − φ·e_s),  p = 1013.25 hPa',
      'over water (T ≥ 0 °C): e_s = 6.112·exp(17.62·T/(243.12 + T)) hPa',
      'over ice (T < 0 °C): e_s = 6.112·exp(22.46·T/(272.62 + T)) hPa',
    ],
    notes: [
      'Latent potential ~2.8 kJ per 1 g of frozen-out water.',
      'The prescribed formula gives 10.93 g/kg for 20 °C / 75 %.',
      'Below 0 °C RH is relative to ice (per the specification); meteorological RH is given relative to water (−15 °C / 85 %: 1.00 instead of 0.86 g/kg).',
    ],
  },
  {
    title: 'Fluid properties',
    eq: ['Equations of state: O₂ Schmidt & Wagner (1985), N₂ Span et al. (2000), Ar Tegeler et al. (1999) – via CoolProp 7.2.0'],
    notes: [
      'Tables generated from CoolProp at build time: saturation by pressure, gas h(p, T) −60 to +40 °C, liquid h_l(T, Δp) with Δp = p − p_sat(T); linear / bilinear interpolation.',
      'Demonstrated accuracy against direct CoolProp (3000 points per fluid): duty ≤ 0.1 % (actually ~0.02 %), T_sat ≤ 0.05 K.',
      'No extrapolation outside the data range – the calculation is blocked with a reason.',
      'Pressure range: O₂ 1–40 bar a, N₂ 1–32 bar a (N₂ critical pressure 33.96 bar – the supercritical regime is a separate task), Ar 1–40 bar a (critical pressure 48.63 bar).',
      'Lower limit of the liquid table just above the triple point: O₂ −218 °C, N₂ −209 °C, Ar −189 °C.',
    ],
  },
];

export function EquationsPage() {
  const EQUATIONS = getLang() === 'cs' ? EQUATIONS_CS : EQUATIONS_EN;
  return (
    <div className="info-page">
      <section className="card">
        <h2>{tr('Rovnice a předpoklady', 'Equations and assumptions')}</h2>
        <p className="note">{tr('Všechny rovnice, které aplikace používá, a jejich předpoklady (kap. 5).', 'All equations the application uses and their assumptions (ch. 5).')}</p>
      </section>
      {EQUATIONS.map((e) => (
        <section key={e.title} className="card">
          <h3>{e.title}</h3>
          {e.eq.map((q) => (
            <code key={q} className="formula">
              {q}
            </code>
          ))}
          {e.notes.length ? (
            <ul className="note">
              {e.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

const sources = (): readonly { text: string; url?: string }[] => [
  {
    text: 'R. Schmidt, W. Wagner: A new form of the equation of state for pure substances and its application to oxygen. Fluid Phase Equilibria 19 (1985) 175–200.',
  },
  {
    text: 'R. Span, E. W. Lemmon, R. T. Jacobsen, W. Wagner, A. Yokozeki: A Reference Equation of State for the Thermodynamic Properties of Nitrogen… J. Phys. Chem. Ref. Data 29 (2000) 1361–1433.',
  },
  {
    text: 'Ch. Tegeler, R. Span, W. Wagner: A New Equation of State for Argon Covering the Fluid Region for Temperatures From the Melting Line to 700 K at Pressures up to 1000 MPa. J. Phys. Chem. Ref. Data 28 (1999) 779–850.',
  },
  { text: 'CoolProp', url: 'https://github.com/CoolProp/CoolProp' },
  {
    text: 'AIGA 027/15 Cryogenic Vaporisation Systems – Prevention of Brittle Fracture of Equipment and Piping',
    url: 'https://asiaiga.org/uploaded_docs/AIGA%20027_15_Prevention%20of%20Brittle%20Fracture%20in%20Cryo%20Equipment%20&%20piping%20Final.pdf',
  },
  {
    text: "AIGA 030/13 / EIGA Doc 115/12 Storage of cryogenic air gases at users' premises",
    url: "https://asiaiga.org/uploaded_docs/AIGA%20030_13_Storage%20of%20cryogenic%20air%20gases%20at%20users'%20premises.pdf",
  },
  { text: 'Chart – Vaporizer sizing', url: 'https://chartindustries.com/Articles/Vaporizer-sizing' },
  { text: 'Chart Thermafin SuperGap Europe', url: 'https://files.chartindustries.com/ThermafinSuperGapEurope.pdf' },
  { text: tr('Chart ThermaCalc (mrazová období)', 'Chart ThermaCalc (frost periods)'), url: 'https://files.chartindustries.com/ChartThermaCalcCloud_2025.pdf' },
  { text: 'Tekoma / Cryonorm datasheet', url: 'https://www.genemco.com/cdn/shop/files/RCJF1518Btekomavaporizer.pdf' },
  { text: tr('Patent US 4,399,660 (námraza v nepřetržitém provozu; ilustrace, ne návrhový koeficient)', 'Patent US 4,399,660 (icing in continuous operation; illustration, not a design factor)') },
  { text: tr('EIGA Doc 33, CGA G-4.1, EN 12300 (kyslíková čistota); EIGA Doc 13 (kyslíkové potrubí)', 'EIGA Doc 33, CGA G-4.1, EN 12300 (oxygen cleanliness); EIGA Doc 13 (oxygen pipelines)') },
];

export function SourcesPage() {
  return (
    <div className="info-page">
      <section className="card">
        <h2>{tr('Zdroje', 'Sources')}</h2>
        <ul className="sources">
          {sources().map((s) => (
            <li key={s.text}>
              {s.text}
              {s.url ? (
                <>
                  {' '}
                  –{' '}
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.url}
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="note">
          {tr(
            'Data výrobců v aplikaci jsou ilustrativní a editovatelná. Vždy ověř v aktuálním katalogu; výběr a garance patří výrobci.',
            'Manufacturer data in the application are illustrative and editable. Always verify in the current catalogue; selection and guarantee belong to the manufacturer.',
          )}
        </p>
        <p className="note">
          {tr('Knihovny třetích stran a jejich licence (React, pdfmake s písmem Roboto, ExcelJS aj.):', 'Third-party libraries and their licences (React, pdfmake with the Roboto font, ExcelJS etc.):')}{' '}
          <a href="third-party-licenses.txt" target="_blank" rel="noreferrer noopener">
            third-party-licenses.txt
          </a>
        </p>
      </section>
    </div>
  );
}
