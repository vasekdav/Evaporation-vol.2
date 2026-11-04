/** Stránky: Postup návrhu (10 kroků), Rovnice a předpoklady, Zdroje. */
import type { FluidId } from '../../core/properties/types';
import { FLUID_POLICY } from '../../core/fluids';
import { guideSteps, type PageId } from '../content/guide';

export function GuidePage({ fluid, go }: { fluid: FluidId; go: (p: PageId, anchor?: string) => void }) {
  const steps = guideSteps(fluid);
  return (
    <div className="info-page">
      <section className="card">
        <h2>Postup návrhu v 10 krocích</h2>
        <p className="note">
          Průvodce návrhem nového odpařovače. Krok 8 se řídí zvolenou látkou ({FLUID_POLICY[fluid].formula}). Ke každému kroku: co
          udělat, vstupy, výstupy a typická chyba.
        </p>
      </section>
      <ol className="guide">
        {steps.map((s) => (
          <li key={s.n} className="card guide-step">
            <h3>
              <span className="step-no">{s.n}</span> {s.title}
            </h3>
            <ul>
              {s.todo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <dl className="guide-dl">
              <dt>Vstupy</dt>
              <dd>{s.inputs}</dd>
              <dt>Výstupy</dt>
              <dd>{s.outputs}</dd>
              <dt>Typická chyba</dt>
              <dd className="mistake">{s.mistake}</dd>
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

const EQUATIONS: readonly { title: string; eq: string[]; notes: string[] }[] = [
  {
    title: '5.1 Hmotnostní průtok',
    eq: ['ρn = ρ(látka; 0 °C; 1,01325 bar) – reálný plyn ze stavové rovnice', 'ṁ [kg/s] = V̇n [Nm³/h] · ρn / 3600'],
    notes: ['O₂: ρn = 1,42903 kg/Nm³; N₂: ρn = 1,25039 kg/Nm³.'],
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
      'p je absolutní tlak; tlaková ztráta zanedbána – 0,5 bar by zvýšila Q asi o +0,05 % (ověřeno: O₂ +0,051 %, N₂ +0,046 %).',
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
      'Model předpokládá stejné U jako při katalogových podmínkách. V mrazu to neplatí (námraza, chybějící latentní teplo, studený vzduch u jednotky) – výsledek je OPTIMISTICKÝ.',
      'LMTD s konstantním c_p nadhodnocuje UA_II zhruba o 1,5 % – na bezpečné straně.',
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
    notes: ['Latentní potenciál ~2,8 kJ na 1 g vymrzlé vody.', 'Předepsaný vzorec dává pro 20 °C / 75 % hodnotu 10,93 g/kg.'],
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

export function EquationsPage() {
  return (
    <div className="info-page">
      <section className="card">
        <h2>Rovnice a předpoklady</h2>
        <p className="note">Všechny rovnice, které aplikace používá, a jejich předpoklady (kap. 5).</p>
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

const SOURCES: readonly { text: string; url?: string }[] = [
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
  { text: 'Chart ThermaCalc (mrazová období)', url: 'https://files.chartindustries.com/ChartThermaCalcCloud_2025.pdf' },
  { text: 'Tekoma / Cryonorm datasheet', url: 'https://www.genemco.com/cdn/shop/files/RCJF1518Btekomavaporizer.pdf' },
  { text: 'Patent US 4,399,660 (námraza v nepřetržitém provozu; ilustrace, ne návrhový koeficient)' },
  { text: 'EIGA Doc 33, CGA G-4.1, EN 12300 (kyslíková čistota); EIGA Doc 13 (kyslíkové potrubí)' },
];

export function SourcesPage() {
  return (
    <div className="info-page">
      <section className="card">
        <h2>Zdroje</h2>
        <ul className="sources">
          {SOURCES.map((s) => (
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
          Data výrobců v aplikaci jsou ilustrativní a editovatelná. Vždy ověř v aktuálním katalogu; výběr a garance patří výrobci.
        </p>
      </section>
    </div>
  );
}
