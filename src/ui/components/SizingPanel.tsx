import { CATALOG_MODEL_SETS, ILLUSTRATION_TITLE, modelsAtOrAbove, type CatalogBasis } from '../../core/catalog';
import { PRACTICE_APPROACH_K, PRACTICE_RESERVE_RANGE } from '../../core/concept';
import type { Evaluation } from '../../core/evaluate';
import { fmt } from '../../core/format';
import { FLUID_POLICY } from '../../core/fluids';
import { Qty, SourceTag } from './Qty';

function Row({ label, children, emphasis }: { label: string; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className={`kv${emphasis ? ' kv-em' : ''}`}>
      <div className="kv-label" data-narrative="">
        {label}
      </div>
      <div className="kv-value">{children}</div>
    </div>
  );
}

/** Posouzení velikosti – ideální dolní mez (kap. 5.4, 7). Vizuálně odlišené, nikdy jako doporučený model. */
export function SizingPanel({ ev, basis }: { ev: Evaluation; basis: CatalogBasis | undefined }) {
  const s = ev.sizing;
  const d = ev.duty;
  if (!s || !d) return null;
  const policy = FLUID_POLICY[ev.input.fluid];
  return (
    <section className="card sizing" aria-labelledby="size-h">
      <div className="band" data-narrative="">
        IDEÁLNÍ DOLNÍ MEZ · model konstantního U · výsledek je OPTIMISTICKÝ · velikost vždy potvrzuje výrobce
      </div>
      <h2 id="size-h">Posouzení velikosti – ideální dolní mez</h2>
      {!s.ok ? (
        <p className="big-invalid" data-narrative="">
          {s.reason}
        </p>
      ) : (
        <>
          <div className="kv-grid">
            <div>
              <h3>Potřeba při teplotě vzduchu pro posouzení</h3>
              <Row label="T_des = MIN(T_okolí, T_min,lokality)">
                <Qty v={s.ua.T_des_C} unit="°C" src="VYPOCET" d={1} />
              </Row>
              <Row label="ΔT_I = T_des − T_sat (zóna varu)">
                <Qty v={s.ua.dT_I_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label="ΔT_out = T_des − T_out">
                <Qty v={s.ua.dT_out_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label="LMTD_II (zóna přehřátí)">
                <Qty v={s.ua.LMTD_II_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label="UA_I = Q_I / ΔT_I">
                <Qty v={s.ua.UA_I_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
              <Row label="UA_II = Q_II / LMTD_II">
                <Qty v={s.ua.UA_II_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
              <Row label="UA_potř">
                <Qty v={s.ua.UA_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
            </div>
            <div>
              <h3>Katalogový základ: {basis?.name ?? s.basisId}</h3>
              {basis ? (
                <>
                  <Row label="Teplota okolí (katalog)">
                    <Qty v={basis.T_amb_C} unit="°C" src="VYROBCE" d={0} />
                  </Row>
                  {basis.RH_pct !== null ? (
                    <Row label="Relativní vlhkost (katalog)">
                      <Qty v={basis.RH_pct} unit="%" src="VYROBCE" d={0} />
                    </Row>
                  ) : null}
                  {basis.pressure ? (
                    <Row label={`Tlak (katalog)${basis.pressureVerified === false ? ' – neověřeno' : ''}`}>
                      <Qty v={basis.pressure.value} unit={basis.pressure.kind === 'gauge' ? 'barg' : 'bar a'} src="VYROBCE" d={2} />
                    </Row>
                  ) : null}
                  {basis.approach_K !== null ? (
                    <Row label="Přiblížení výstupní teploty (katalog)">
                      <Qty v={basis.approach_K} unit="K" src="VYROBCE" d={0} />
                    </Row>
                  ) : null}
                </>
              ) : null}
              <Row label="Katalogový případ: nasycená kapalina, T_out,kat">
                <Qty v={s.ua1.T_out_C} unit="°C" src="VYPOCET" d={1} />
              </Row>
              <Row label={`UA₁ (${policy.formula}, na 1 Nm³/h)`}>
                <Qty v={s.ua1.UA1_W_K_per_Nm3h} unit="W/K na Nm³/h" src="VYPOCET" d={4} />
              </Row>
            </div>
          </div>
          <div className="kv-grid result-rows">
            <Row label="Ideální ekvivalent N_eq = UA_potř / UA₁" emphasis>
              <span data-testid="Neq">
                <Qty v={s.N_eq_Nm3_h} unit={`Nm³/h (${policy.catalogColumn}, katalogový základ)`} src="VYPOCET" d={1} />
              </span>
            </Row>
            <Row label="Koeficient námrazy / rezervy k">
              <Qty v={s.k} unit="–" src="VSTUP" d={2} />
            </Row>
            <Row label="Tepelná náročnost N_eq·k / V̇n">
              <Qty v={s.thermalDemand} unit="–" src="VYPOCET" d={3} />
            </Row>
            <Row label="Nejmenší jmenovitá kapacita větve = MAX(V̇n; N_eq·k)" emphasis>
              <span data-testid="minCap">
                <Qty v={s.minBranchCapacity_Nm3_h} unit="Nm³/h" src="VYPOCET" d={0} />
              </span>
              <span className="lower-bound" data-narrative="">
                dolní hranice pro poptávku – NE doporučený model
              </span>
            </Row>
            <Row label="Orientační rezerva praxe 1,2–1,5× průtoku">
              <span>
                <Qty v={d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[0]} unit="Nm³/h" src="PRAXE" d={0} /> až{' '}
                <Qty v={d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[1]} unit="Nm³/h" src="PRAXE" d={0} />
              </span>
              <span className="muted" data-narrative="">
                Jen při přiblížení ≈ {PRACTICE_APPROACH_K} K; tvé přiblížení je {fmt(s.ua.dT_out_K, 1)} K.
                {s.ua.dT_out_K < PRACTICE_APPROACH_K ? ' Při menším přiblížení bývá potřeba výrazně víc.' : ''} Odhad praxe, ne norma –
                rozhoduje přepočet výrobce.
              </span>
            </Row>
          </div>
          <ul className="warnings" data-narrative="">
            {s.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <ModelIllustration basis={basis} minCapacity={s.minBranchCapacity_Nm3_h} fluid={ev.input.fluid} />
        </>
      )}
    </section>
  );
}

function ModelIllustration({
  basis,
  minCapacity,
  fluid,
}: {
  basis: CatalogBasis | undefined;
  minCapacity: number;
  fluid: Evaluation['input']['fluid'];
}) {
  const set = basis?.modelsId ? CATALOG_MODEL_SETS.find((m) => m.id === basis.modelsId) : undefined;
  if (!basis || !set) {
    return (
      <p className="note" data-narrative="">
        Ke katalogovému základu není v aplikaci tabulka modelů.
      </p>
    );
  }
  const col = FLUID_POLICY[fluid].catalogColumn;
  const models = modelsAtOrAbove(set, col, minCapacity);
  const byName = new Map(set.models.map((m) => [m.model, m]));
  return (
    <div className="illustration">
      <h3>
        {ILLUSTRATION_TITLE} <SourceTag src="VYROBCE" />
      </h3>
      <p className="note" data-narrative="">
        Modely {basis.name}, jejichž katalogová kapacita (sloupec {col}) je alespoň nejmenší kapacita větve. Údaje výrobce jsou
        ilustrativní; výběr modelu a garanci dává výrobce přepočtem na lokalitu.
        {basis.hpLinedFactor !== null ? ` HP lined jednotky ×${fmt(basis.hpLinedFactor, 1)}.` : ''}
      </p>
      {models.length === 0 ? (
        <p data-narrative="">Žádný model z ukázkové tabulky nedosahuje nejmenší kapacity větve – poptej výrobce.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Kapacita {col}</th>
                <th scope="col">Plocha</th>
                <th scope="col">Výška</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const full = byName.get(m.model)!;
                return (
                  <tr key={m.model}>
                    <td data-narrative="">{m.model}</td>
                    <td>
                      <Qty v={m.capacity_Nm3_h} unit="Nm³/h" src="VYROBCE" d={0} />
                    </td>
                    <td>
                      <Qty v={full.area_m2} unit="m²" src="VYROBCE" d={0} />
                    </td>
                    <td>
                      <Qty v={full.height_m} unit="m" src="VYROBCE" d={2} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note" data-narrative="">
        Výrobci mají různé katalogové základy. Modely různých výrobců nesrovnávej podle katalogových Nm³/h bez přepočtu.
      </p>
    </div>
  );
}
