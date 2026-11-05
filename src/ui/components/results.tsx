import { levelText, type CheckLevel, type CheckResult } from '../../core/checks';
import { tr } from '../../core/i18n';
import type { Evaluation } from '../../core/evaluate';
import { FLUID_POLICY } from '../../core/fluids';
import { APP, SOURCE_LABEL, type Source } from '../texts';
import { Qty, SourceTag } from './Qty';

const STATUS_CLASS: Record<Evaluation['status'], string> = {
  ALL_OK: 'st-ok',
  VALID_WITH_WARNINGS: 'st-warn',
  INCOMPLETE: 'st-warn',
  DESIGN_FAILS: 'st-fail',
  INVALID: 'st-invalid',
};

/** Kontroly, které určují stav (CHYBA, POZOR, nezadané údaje) – pro odkazy ve stavovém pruhu. */
export function statusReasons(ev: Evaluation): CheckResult[] {
  return ev.checks.filter((c) => c.level === 'CHYBA' || c.level === 'POZOR' || (c.id === 'D1' && c.level === 'NEZADÁNO'));
}

export function StatusBanner({ ev }: { ev: Evaluation }) {
  const reasons = statusReasons(ev);
  return (
    <div className={`status ${STATUS_CLASS[ev.status]}`}>
      <div role="status" aria-live="polite" data-testid="status">
        {ev.statusText}
      </div>
      {reasons.length ? (
        <ul className="status-reasons" aria-label={tr('Důvody stavu', 'Reasons for status')} data-narrative="">
          {reasons.map((c) => (
            <li key={c.id}>
              <a href={`#chk-${c.id}`}>
                {c.id} {c.title} – {levelText(c.level)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Obsah stránky výsledků – rychlý skok na sekci (dlouhá stránka na tabletu). */
export function SectionNav() {
  const items: [string, string][] = [
    ['res-h', tr('Výsledek', 'Result')],
    ['chk-h', tr('Kontroly', 'Checks')],
    ['size-h', tr('Velikost', 'Sizing')],
    ['concept-h', tr('Koncept', 'Concept')],
    ['sens-h', tr('Citlivost', 'Sensitivity')],
    ['steps-h', tr('Postup výpočtu', 'Calculation steps')],
  ];
  return (
    <nav className="section-nav" aria-label={tr('Obsah stránky', 'Page contents')}>
      {items.map(([id, label]) => (
        <a key={id} href={`#${id}`}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function SourceLegend() {
  return (
    <div className="legend" data-narrative="">
      {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
        <span key={s}>
          <SourceTag src={s} /> {SOURCE_LABEL[s].long}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{children}</div>
      {note ? (
        <div className="stat-note" data-narrative="">
          {note}
        </div>
      ) : null}
    </div>
  );
}

export function ResultCard({ ev }: { ev: Evaluation }) {
  const d = ev.duty;
  const policy = FLUID_POLICY[ev.input.fluid];
  if (!d) {
    const blocking = ev.checks.filter((c) => c.blocking);
    return (
      <section className="card result invalid" aria-labelledby="res-h">
        <h2 id="res-h">{tr('Výsledek', 'Result')}</h2>
        <p className="big-invalid">{tr('Výsledek nelze zobrazit – oprav vstupy.', 'The result cannot be shown – correct the inputs.')}</p>
        <ul data-narrative="">
          {blocking.map((c) => (
            <li key={c.id}>
              <strong>{c.id}</strong> {c.message}
            </li>
          ))}
          {ev.error ? <li>{ev.error}</li> : null}
        </ul>
      </section>
    );
  }
  const c = ev.consumptionPerDay!;
  return (
    <section className="card result" aria-labelledby="res-h">
      <h2 id="res-h">{tr('Výsledek – tepelná potřeba', 'Result – heat duty')}</h2>
      <div className="hero">
        <div className="hero-label">{tr('Návrhový výkon Q', 'Design duty Q')}</div>
        <div className="hero-value" data-testid="Q">
          <Qty v={d.Q_kW} unit="kW" src="VYPOCET" d={2} />
        </div>
        <div className={`hero-status ${STATUS_CLASS[ev.status]}`}>{ev.statusText}</div>
      </div>
      <div className="stats">
        <Stat label={tr('Zóna I – var (ohřev + odpaření)', 'Zone I – boiling (warming + evaporation)')}>
          <Qty v={d.Q_I_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label={tr('Zóna II – přehřátí plynu', 'Zone II – gas superheating')}>
          <Qty v={d.Q_II_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label={tr('Q pro nasycenou kapalinu (minimum)', 'Q for saturated liquid (minimum)')}>
          <Qty v={d.Q_sat_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label={tr('Hmotnostní průtok ṁ', 'Mass flow ṁ')}>
          <Qty v={d.m_kg_h} unit="kg/h" src="VYPOCET" d={1} />
          <Qty v={d.m_kg_s} unit="kg/s" src="VYPOCET" d={4} className="sub" />
        </Stat>
        <Stat label={tr('Použitý absolutní tlak', 'Absolute pressure used')}>
          <Qty v={d.p_bar_a} unit="bar a" src="VYPOCET" d={3} />
        </Stat>
        <Stat label={tr('Teplota nasycení při p', 'Saturation temperature at p')}>
          <Qty v={d.T_sat_C} unit="°C" src="VYPOCET" d={2} />
        </Stat>
        <Stat
          label={tr(`Spotřeba ${policy.liquidLabel} za den`, `${policy.liquidLabel} consumption per day`)}
          note={tr(
            `Při ${c.hours === 24 ? 'provozu 24/7' : `${c.hours} h provozu denně`} a špičkovém průtoku.`,
            `At ${c.hours === 24 ? '24/7 operation' : `${c.hours} h of operation per day`} and peak flow.`,
          )}
        >
          <Qty v={c.mass_kg} unit="kg" src="VYPOCET" d={0} />
          <span className="sub">
            <Qty v={c.volume_m3} unit="m³" src="VYPOCET" d={2} /> <span className="muted" data-narrative="">{tr('při stavu na vstupu', 'at inlet state')}</span>
          </span>
          {c.volume_nbp_m3 !== null ? (
            <span className="sub">
              <Qty v={c.volume_nbp_m3} unit="m³" src="VYPOCET" d={2} />{' '}
              <span className="muted" data-narrative="">{tr('jako kapalina při 1,01325 bar', 'as liquid at 1.01325 bar')}</span>
            </span>
          ) : null}
        </Stat>
        {ev.reheat ? (
          <Stat label={tr('Výkon dohřevu', 'Trim heater duty')}>
            {ev.reheat.ok ? (
              <Qty v={ev.reheat.Q_kW} unit="kW" src="VYPOCET" />
            ) : (
              <span className="muted" data-narrative="">
                {ev.reheat.reason}
              </span>
            )}
          </Stat>
        ) : null}
      </div>
      <p className="note" data-narrative="">
        {APP.notKw}
      </p>
    </section>
  );
}

const LEVEL_CLASS: Record<CheckLevel, string> = {
  OK: 'lv-ok',
  INFO: 'lv-info',
  NEZADÁNO: 'lv-na',
  NEHODNOCENO: 'lv-na',
  POZOR: 'lv-warn',
  CHYBA: 'lv-err',
};

function CheckRow({ c }: { c: CheckResult }) {
  return (
    <li className={`check-row ${LEVEL_CLASS[c.level]}`} data-check={c.id} data-level={c.level} id={`chk-${c.id}`} tabIndex={-1}>
      <span className="light" aria-hidden="true" />
      <span className="check-id" data-narrative="">
        {c.id}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{c.title}</strong>
          <span className="level">{levelText(c.level)}</span>
          {c.blocking ? <span className="blocks">{tr('blokuje výsledek', 'blocks the result')}</span> : c.designFailure ? <span className="blocks">{tr('návrh nevyhovuje', 'design fails')}</span> : null}
          {c.reference ? (
            <span className="ref" data-narrative="">
              {c.reference}
            </span>
          ) : null}
        </div>
        <p data-narrative="">{c.message}</p>
      </div>
    </li>
  );
}

export function ChecksPanel({ ev }: { ev: Evaluation }) {
  return (
    <section className="card" aria-labelledby="chk-h">
      <h2 id="chk-h">{tr('Kontroly K1–K8 a doplňkové D1–D4', 'Checks K1–K8 and additional D1–D4')}</h2>
      <ul className="checks">
        {ev.checks.map((c) => (
          <CheckRow key={c.id} c={c} />
        ))}
      </ul>
      <p className="note" data-narrative="">
        {tr(
          'K1–K8 hlídají rozsah dat a bezpečnost (křehký lom a TSL podle AIGA 027) podle zadání; D1–D4 doplňují úplnost údajů, úsek před dohřevem, věrohodnost modelu a provoz vs. katalog. CHYBA ve vstupech výsledek zablokuje; CHYBA návrhu (TSL, křehký lom v mrazu) výkon nechá platný, ale návrh nevyhovuje. Kontroly jsou statická kontrola konzistence návrhových teplot – nenahrazují HAZOP / LOPA, ověření SIL ani projekt.',
          'K1–K8 check the data range and safety (brittle fracture and TSL per AIGA 027) as specified; D1–D4 add completeness of data, the section upstream of the trim heater, model plausibility and operation vs. catalogue. An ERROR in the inputs blocks the result; a design ERROR (TSL, brittle fracture in frost) leaves the duty valid but the design fails. The checks are a static consistency check of design temperatures – they do not replace HAZOP / LOPA, SIL verification or the engineering design.',
        )}
      </p>
    </section>
  );
}
