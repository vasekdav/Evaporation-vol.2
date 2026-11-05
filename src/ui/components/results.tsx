import type { CheckLevel, CheckResult } from '../../core/checks';
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

export function StatusBanner({ ev }: { ev: Evaluation }) {
  return (
    <div className={`status ${STATUS_CLASS[ev.status]}`} role="status" aria-live="polite" data-testid="status">
      {ev.statusText}
    </div>
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
        <h2 id="res-h">Výsledek</h2>
        <p className="big-invalid">Výsledek nelze zobrazit – oprav vstupy.</p>
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
      <h2 id="res-h">Výsledek – tepelná potřeba</h2>
      <div className="hero">
        <div className="hero-label">Návrhový výkon Q</div>
        <div className="hero-value" data-testid="Q">
          <Qty v={d.Q_kW} unit="kW" src="VYPOCET" d={2} />
        </div>
        <div className={`hero-status ${STATUS_CLASS[ev.status]}`}>{ev.statusText}</div>
      </div>
      <div className="stats">
        <Stat label="Zóna I – var (ohřev + odpaření)">
          <Qty v={d.Q_I_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label="Zóna II – přehřátí plynu">
          <Qty v={d.Q_II_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label="Q pro nasycenou kapalinu (minimum)">
          <Qty v={d.Q_sat_kW} unit="kW" src="VYPOCET" />
        </Stat>
        <Stat label="Hmotnostní průtok ṁ">
          <Qty v={d.m_kg_h} unit="kg/h" src="VYPOCET" d={1} />
          <Qty v={d.m_kg_s} unit="kg/s" src="VYPOCET" d={4} className="sub" />
        </Stat>
        <Stat label="Použitý absolutní tlak">
          <Qty v={d.p_bar_a} unit="bar a" src="VYPOCET" d={3} />
        </Stat>
        <Stat label="Teplota nasycení při p">
          <Qty v={d.T_sat_C} unit="°C" src="VYPOCET" d={2} />
        </Stat>
        <Stat label={`Spotřeba ${policy.liquidLabel} za den`} note={`Při ${c.hours === 24 ? 'provozu 24/7' : `${c.hours} h provozu denně`} a špičkovém průtoku.`}>
          <Qty v={c.mass_kg} unit="kg" src="VYPOCET" d={0} />
          <span className="sub">
            <Qty v={c.volume_m3} unit="m³" src="VYPOCET" d={2} /> <span className="muted" data-narrative="">při stavu na vstupu</span>
          </span>
          {c.volume_nbp_m3 !== null ? (
            <span className="sub">
              <Qty v={c.volume_nbp_m3} unit="m³" src="VYPOCET" d={2} />{' '}
              <span className="muted" data-narrative="">jako kapalina při 1,01325 bar</span>
            </span>
          ) : null}
        </Stat>
        {ev.reheat ? (
          <Stat label="Výkon dohřevu">
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
    <li className={`check-row ${LEVEL_CLASS[c.level]}`} data-check={c.id} data-level={c.level}>
      <span className="light" aria-hidden="true" />
      <span className="check-id" data-narrative="">
        {c.id}
      </span>
      <div className="check-body">
        <div className="check-head">
          <strong>{c.title}</strong>
          <span className="level">{c.level}</span>
          {c.blocking ? <span className="blocks">blokuje výsledek</span> : c.designFailure ? <span className="blocks">návrh nevyhovuje</span> : null}
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
      <h2 id="chk-h">Kontroly K1–K8 a doplňkové D1–D4</h2>
      <ul className="checks">
        {ev.checks.map((c) => (
          <CheckRow key={c.id} c={c} />
        ))}
      </ul>
      <p className="note" data-narrative="">
        K1–K8 hlídají rozsah dat a bezpečnost (křehký lom a TSL podle AIGA 027) podle zadání; D1–D4 doplňují úplnost údajů,
        úsek před dohřevem, věrohodnost modelu a provoz vs. katalog. CHYBA ve vstupech výsledek zablokuje; CHYBA návrhu (TSL,
        křehký lom v mrazu) výkon nechá platný, ale návrh nevyhovuje. Kontroly jsou statická kontrola konzistence návrhových
        teplot – nenahrazují HAZOP / LOPA, ověření SIL ani projekt.
      </p>
    </section>
  );
}
