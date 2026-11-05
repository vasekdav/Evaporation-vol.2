import { CATALOG_MODEL_SETS, hasColumn, illustrationTitle, modelsAtOrAbove, type CatalogBasis } from '../../core/catalog';
import { PRACTICE_APPROACH_K, PRACTICE_RESERVE_RANGE } from '../../core/concept';
import type { Evaluation } from '../../core/evaluate';
import { fmt } from '../../core/format';
import { tr } from '../../core/i18n';
import { FLUID_POLICY } from '../../core/fluids';
import { useId, useState } from 'react';
import { assessExisting, type SizingResult } from '../../core/sizing';
import { NumberInput } from './fields';
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
  const set = basis?.modelsId ? CATALOG_MODEL_SETS.find((m) => m.id === basis.modelsId) : undefined;
  const noColumn = !set || !hasColumn(set, policy.catalogColumn);
  return (
    <section className="card sizing" aria-labelledby="size-h">
      <div className="band" data-narrative="">
        {tr('IDEÁLNÍ DOLNÍ MEZ · model konstantního U · výsledek je OPTIMISTICKÝ · velikost vždy potvrzuje výrobce', 'IDEAL LOWER BOUND · constant-U model · the result is OPTIMISTIC · the size is always confirmed by the manufacturer')}
      </div>
      <h2 id="size-h">{tr('Posouzení velikosti – ideální dolní mez', 'Size assessment – ideal lower bound')}</h2>
      {!s.ok ? (
        <p className="big-invalid" data-narrative="">
          {s.reason}
        </p>
      ) : (
        <>
          <div className="kv-grid">
            <div>
              <h3>{tr('Potřeba při teplotě vzduchu pro posouzení', 'Requirement at the assessment air temperature')}</h3>
              <Row label={tr('T_des = MIN(T_okolí, T_min,lokality)', 'T_des = MIN(T_amb, T_min,site)')}>
                <Qty v={s.ua.T_des_C} unit="°C" src="VYPOCET" d={1} />
              </Row>
              <Row label={tr('ΔT_I = T_des − T_sat (zóna varu)', 'ΔT_I = T_des − T_sat (boiling zone)')}>
                <Qty v={s.ua.dT_I_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label="ΔT_out = T_des − T_out">
                <Qty v={s.ua.dT_out_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label={tr('LMTD_II (zóna přehřátí)', 'LMTD_II (superheating zone)')}>
                <Qty v={s.ua.LMTD_II_K} unit="K" src="VYPOCET" d={2} />
              </Row>
              <Row label="UA_I = Q_I / ΔT_I">
                <Qty v={s.ua.UA_I_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
              <Row label="UA_II = Q_II / LMTD_II">
                <Qty v={s.ua.UA_II_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
              <Row label={tr('UA_potř', 'UA_req')}>
                <Qty v={s.ua.UA_W_K / 1000} unit="kW/K" src="VYPOCET" d={3} />
              </Row>
            </div>
            <div>
              <h3>{tr('Katalogový základ', 'Catalogue basis')}: {basis?.name ?? s.basisId}</h3>
              {basis ? (
                <>
                  <Row label={tr('Teplota okolí (katalog)', 'Ambient temperature (catalogue)')}>
                    <Qty v={basis.T_amb_C} unit="°C" src="VYROBCE" d={0} />
                  </Row>
                  {basis.RH_pct !== null ? (
                    <Row label={tr('Relativní vlhkost (katalog)', 'Relative humidity (catalogue)')}>
                      <Qty v={basis.RH_pct} unit="%" src="VYROBCE" d={0} />
                    </Row>
                  ) : null}
                  {basis.pressure ? (
                    <Row label={`${tr('Tlak (katalog)', 'Pressure (catalogue)')}${basis.pressureVerified === false ? tr(' – neověřeno', ' – unverified') : ''}`}>
                      <Qty v={basis.pressure.value} unit={basis.pressure.kind === 'gauge' ? 'barg' : 'bar a'} src="VYROBCE" d={2} />
                    </Row>
                  ) : null}
                  {basis.approach_K !== null ? (
                    <Row label={tr('Přiblížení výstupní teploty (katalog)', 'Outlet temperature approach (catalogue)')}>
                      <Qty v={basis.approach_K} unit="K" src="VYROBCE" d={0} />
                    </Row>
                  ) : null}
                  <Row label={tr('Doba provozu (katalog)', 'Run time (catalogue)')}>
                    {basis.runtime_h !== null ? (
                      <Qty v={basis.runtime_h} unit="h" src="VYROBCE" d={0} />
                    ) : (
                      <span className="muted" data-narrative="">
                        {tr('neuvedeno – vyžádej od výrobce', 'not stated – request from the manufacturer')}
                      </span>
                    )}
                  </Row>
                </>
              ) : null}
              <Row label={tr('Katalogový případ: nasycená kapalina, T_out,kat', 'Catalogue case: saturated liquid, T_out,cat')}>
                <Qty v={s.ua1.T_out_C} unit="°C" src="VYPOCET" d={1} />
              </Row>
              <Row label={`UA₁ (${policy.formula}, ${tr('na 1 Nm³/h', 'per 1 Nm³/h')})`}>
                <Qty v={s.ua1.UA1_W_K_per_Nm3h} unit={tr('W/K na Nm³/h', 'W/K per Nm³/h')} src="VYPOCET" d={4} />
              </Row>
            </div>
          </div>
          <div className="kv-grid result-rows">
            <Row label={tr('Ideální ekvivalent N_eq = UA_potř / UA₁', 'Ideal equivalent N_eq = UA_req / UA₁')} emphasis>
              <span data-testid="Neq">
                <Qty
                  v={s.N_eq_Nm3_h}
                  unit={noColumn ? tr('Nm³/h – fyzikální ekvivalent', 'Nm³/h – physical equivalent') : `Nm³/h (${policy.catalogColumn}, ${tr('katalogový základ', 'catalogue basis')})`}
                  src="VYPOCET"
                  d={1}
                />
              </span>
              {noColumn ? (
                <span className="muted" data-narrative="">
                  {tr(
                    `Katalog v aplikaci nemá sloupec ${policy.catalogColumn} – jde jen o fyzikální ekvivalent vůči UA₁ této látky.`,
                    `The catalogue in the application has no ${policy.catalogColumn} column – this is only a physical equivalent relative to UA₁ of this fluid.`,
                  )}
                </span>
              ) : null}
            </Row>
            <Row label={tr('Koeficient námrazy / rezervy k (násobí N_eq)', 'Frost / reserve factor k (multiplies N_eq)')}>
              <Qty v={s.k} unit="×" src="VSTUP" d={2} />
            </Row>
            <Row label={tr('Tepelná náročnost N_eq·k / V̇n', 'Thermal demand N_eq·k / V̇n')}>
              <Qty v={s.thermalDemand} unit={tr('× průtoku', '× flow')} src="VYPOCET" d={3} />
              {s.thermalDemand < 1 ? (
                <span className="muted" data-narrative="">
                  {tr('Méně než 1 jen díky velkému přiblížení v ideálním modelu – v praxi to neznamená menší odpařovač než katalogový průtok.', 'Below 1 only because of the large approach in the ideal model – in practice it does not mean a vaporizer smaller than the catalogue flow.')}
                </span>
              ) : null}
            </Row>
            <Row label={tr('Nejmenší jmenovitá kapacita větve = MAX(V̇n; N_eq·k)', 'Minimum nominal branch capacity = MAX(V̇n; N_eq·k)')} emphasis>
              <span data-testid="minCap">
                <Qty v={s.minBranchCapacity_Nm3_h} unit="Nm³/h" src="VYPOCET" d={0} />
              </span>
              <span className="lower-bound" data-narrative="">
                {tr('dolní hranice pro poptávku – NE doporučený model', 'lower bound for the enquiry – NOT a recommended model')}
              </span>
            </Row>
            <Row label={tr('Orientační rezerva praxe 1,2–1,5× průtoku', 'Indicative practice reserve 1.2–1.5× flow')}>
              <span>
                <Qty v={d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[0]} unit="Nm³/h" src="PRAXE" d={0} /> {tr('až', 'to')}{' '}
                <Qty v={d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[1]} unit="Nm³/h" src="PRAXE" d={0} />
              </span>
              {s.minBranchCapacity_Nm3_h < d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[0] ? (
                <span className="below-practice" data-narrative="" data-testid="below-practice">
                  {tr('Nejmenší kapacita větve je pod orientační rezervou praxe – k násobí N_eq, ne průtok.', 'The minimum branch capacity is below the indicative practice reserve – k multiplies N_eq, not the flow.')}
                </span>
              ) : null}
              <span className="muted" data-narrative="">
                {tr(
                  `Jen při přiblížení ≈ ${PRACTICE_APPROACH_K} K; tvé přiblížení je ${fmt(s.ua.dT_out_K, 1)} K.`,
                  `Only at an approach of ≈ ${PRACTICE_APPROACH_K} K; your approach is ${fmt(s.ua.dT_out_K, 1)} K.`,
                )}
                {s.ua.dT_out_K < PRACTICE_APPROACH_K ? tr(' Při menším přiblížení bývá potřeba výrazně víc.', ' A smaller approach usually needs considerably more.') : ''}{' '}
                {tr('Odhad praxe, ne norma – rozhoduje přepočet výrobce.', 'A practice estimate, not a standard – the manufacturer recalculation decides.')}
              </span>
            </Row>
          </div>
          <ul className="warnings" data-narrative="">
            {s.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <ModelIllustration
            basis={basis}
            minCapacity={s.minBranchCapacity_Nm3_h}
            practiceCapacity={d.Vn_Nm3_h * PRACTICE_RESERVE_RANGE[0]}
            fluid={ev.input.fluid}
          />
          <ExistingCheck ev={ev} sizing={s} basis={basis} />
        </>
      )}
    </section>
  );
}

function ModelIllustration({
  basis,
  minCapacity,
  practiceCapacity,
  fluid,
}: {
  basis: CatalogBasis | undefined;
  minCapacity: number;
  practiceCapacity: number;
  fluid: Evaluation['input']['fluid'];
}) {
  const set = basis?.modelsId ? CATALOG_MODEL_SETS.find((m) => m.id === basis.modelsId) : undefined;
  if (!basis || !set) {
    return (
      <p className="note" data-narrative="">
        {tr('Ke katalogovému základu není v aplikaci tabulka modelů.', 'There is no model table in the application for this catalogue basis.')}
      </p>
    );
  }
  const col = FLUID_POLICY[fluid].catalogColumn;
  if (!hasColumn(set, col)) {
    return (
      <div className="illustration">
        <h3>
          {illustrationTitle()} <SourceTag src="VYROBCE" />
        </h3>
        <p className="note" data-narrative="" data-testid="no-column">
          {tr(
            `Ukázková tabulka modelů ${basis.name} v aplikaci nemá sloupec ${col}. Kapacity LOX ani LIN se na ${col} nepřepočítávají – vyžádej si od výrobce katalogovou kapacitu pro ${FLUID_POLICY[fluid].name_cs}, případně ji doplň do dat výrobce.`,
            `The sample model table ${basis.name} in the application has no ${col} column. LOX and LIN capacities are not converted to ${col} – request the catalogue capacity for ${FLUID_POLICY[fluid].name_en} from the manufacturer, or add it to the manufacturer data.`,
          )}
        </p>
      </div>
    );
  }
  const models = modelsAtOrAbove(set, col, minCapacity);
  const byName = new Map(set.models.map((m) => [m.model, m]));
  return (
    <div className="illustration">
      <h3>
        {illustrationTitle()} <SourceTag src="VYROBCE" />
      </h3>
      <p className="note" data-narrative="">
        {tr(
          `Modely ${basis.name}, jejichž katalogová kapacita (sloupec ${col}) je alespoň nejmenší kapacita větve. Údaje výrobce jsou ilustrativní; výběr modelu a garanci dává výrobce přepočtem na lokalitu.`,
          `${basis.name} models whose catalogue capacity (column ${col}) is at least the minimum branch capacity. Manufacturer data are illustrative; the model choice and guarantee come from the manufacturer recalculation for the site.`,
        )}
        {basis.hpLinedFactor !== null ? ` ${tr('HP lined jednotky', 'HP lined units')} ×${fmt(basis.hpLinedFactor, 1)}.` : ''}
      </p>
      {models.length === 0 ? (
        <p data-narrative="">{tr('Žádný model z ukázkové tabulky nedosahuje nejmenší kapacity větve – poptej výrobce.', 'No model in the sample table reaches the minimum branch capacity – ask the manufacturer.')}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">{tr('Kapacita', 'Capacity')} {col}</th>
                <th scope="col">{tr('Plocha', 'Area')}</th>
                <th scope="col">{tr('Výška', 'Height')}</th>
                <th scope="col">{tr('Pásmo praxe', 'Practice band')}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const full = byName.get(m.model)!;
                return (
                  <tr key={m.model} className={m.capacity_Nm3_h < practiceCapacity ? 'below' : ''}>
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
                    <td data-narrative="">{m.capacity_Nm3_h < practiceCapacity ? tr('pod 1,2× průtoku', 'below 1.2× flow') : tr('≥ 1,2× průtoku', '≥ 1.2× flow')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note" data-narrative="">
        {tr('Výrobci mají různé katalogové základy. Modely různých výrobců nesrovnávej podle katalogových Nm³/h bez přepočtu.', 'Manufacturers use different catalogue bases. Do not compare models of different manufacturers by catalogue Nm³/h without recalculation.')}
      </p>
    </div>
  );
}

/** Kontrola stávajícího odpařovače (scénář S3). */
function ExistingCheck({
  ev,
  sizing,
  basis,
}: {
  ev: Evaluation;
  sizing: Extract<SizingResult, { ok: true }>;
  basis: CatalogBasis | undefined;
}) {
  const idSel = useId();
  const idCap = useId();
  const col = FLUID_POLICY[ev.input.fluid].catalogColumn;
  const set = basis?.modelsId ? CATALOG_MODEL_SETS.find((m) => m.id === basis.modelsId) : undefined;
  const models = set ? set.models.filter((m) => m[col] !== undefined) : [];
  const [model, setModel] = useState('');
  const [own, setOwn] = useState<number | null>(null);
  const chosen = models.find((m) => m.model === model);
  const capacity = chosen ? chosen[col]! : own;
  const a = capacity !== null && Number.isFinite(capacity) && capacity > 0 ? assessExisting(capacity, sizing, ev.duty!.Vn_Nm3_h) : null;
  const tslReserve = ev.input.TSL_C !== null ? ev.input.T_out_C - ev.input.TSL_C : null;
  return (
    <div className="existing" data-testid="existing">
      <h3>{tr('Kontrola stávajícího odpařovače (S3)', 'Check of an existing vaporizer (S3)')}</h3>
      <div className="row">
        {models.length ? (
          <label className="inline-field" htmlFor={idSel}>
            {tr('Model z katalogu', 'Model from catalogue')}
            <select id={idSel} value={model} onChange={(e) => setModel(e.target.value)} data-narrative="">
              <option value="">{tr('– vlastní kapacita –', '– own capacity –')}</option>
              {models.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.model}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!chosen ? (
          <label className="inline-field" htmlFor={idCap}>
            {tr('Katalogová kapacita jedné provozní větve', 'Catalogue capacity of one operating branch')}
            <NumberInput id={idCap} value={own} optional unit="Nm³/h" onChange={setOwn} />
          </label>
        ) : null}
      </div>
      {a ? (
        <p className={`existing-verdict v-${a.verdict}`} data-narrative="" data-testid="existing-verdict">
          {a.text}
        </p>
      ) : (
        <p className="note" data-narrative="">
          {tr('Vyber model nebo zadej katalogovou kapacitu jedné provozní větve (údaj výrobce za katalogových podmínek).', 'Choose a model or enter the catalogue capacity of one operating branch (manufacturer figure at catalogue conditions).')}
        </p>
      )}
      <p className="note">
        <span data-narrative="">{tr('Rezerva výstupní teploty nad TSL: ', 'Outlet temperature margin above TSL: ')}</span>
        {tslReserve !== null ? (
          <Qty v={tslReserve} unit="K" src="VYPOCET" d={1} />
        ) : (
          <span data-narrative="">{tr('TSL nezadáno', 'TSL not set')}</span>
        )}
      </p>
    </div>
  );
}
