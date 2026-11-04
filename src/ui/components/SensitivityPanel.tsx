import { useMemo } from 'react';
import type { CatalogBasis } from '../../core/catalog';
import type { Evaluation } from '../../core/evaluate';
import { fmt } from '../../core/format';
import { getProvider } from '../../core/properties';
import { absoluteHumidity_g_kg, LATENT_KJ_PER_G } from '../../core/psychro';
import { range, sweepAmbientTemp, sweepHumidity, sweepOutletTemp, type SensPoint } from '../../core/sensitivity';
import { LineChart } from './LineChart';
import { Qty, SourceTag } from './Qty';

function SensTable({ caption, xLabel, points }: { caption: string; xLabel: string; points: readonly SensPoint[] }) {
  return (
    <details className="table-view">
      <summary>Tabulka: {caption}</summary>
      <div className="table-scroll" data-chart="">
        <table>
          <caption>
            {caption} <SourceTag src="VYPOCET" />
          </caption>
          <thead>
            <tr>
              <th scope="col">{xLabel} [°C]</th>
              <th scope="col">Q [kW]</th>
              <th scope="col">N_eq [Nm³/h kat.]</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.x}>
                <td>{fmt(p.x, 1)}</td>
                <td>{p.Q_kW === null ? '–' : fmt(p.Q_kW, 2)}</td>
                <td>{p.N_eq_Nm3_h === null ? 'nelze' : fmt(p.N_eq_Nm3_h, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const toSeries = (pts: readonly SensPoint[], key: 'Q_kW' | 'N_eq_Nm3_h') => pts.map((p) => ({ x: p.x, y: p[key] }));

export function SensitivityPanel({ ev, basis }: { ev: Evaluation; basis: CatalogBasis | undefined }) {
  const d = ev.duty;
  const data = useMemo(() => {
    if (!d || !basis || ev.T_des_C === null) return null;
    const props = getProvider(ev.input.fluid);
    const base = { Vn_Nm3_h: d.Vn_Nm3_h, p_bar_a: d.p_bar_a, liquid: ev.input.liquid, T_out_C: d.T_out_C };
    return {
      tout: sweepOutletTemp(props, base, basis, ev.T_des_C, range(props.meta.T_gas_min_C, 20, 2.5)),
      tamb: sweepAmbientTemp(props, base, basis, range(-20, 20, 1)),
      hum: sweepHumidity(ev.input.RH_winter_pct, range(-20, 20, 1)),
    };
  }, [d, basis, ev.T_des_C, ev.input.fluid, ev.input.liquid]);
  if (!d || !data) return null;
  const neqNow = ev.sizing?.ok ? ev.sizing.N_eq_Nm3_h : null;
  const T_des = ev.T_des_C!;
  const RH = ev.input.RH_winter_pct;
  const xSummer = absoluteHumidity_g_kg(20, 75);
  const xWinter = absoluteHumidity_g_kg(-15, 85);

  return (
    <section className="card" aria-labelledby="sens-h">
      <h2 id="sens-h">Citlivost</h2>
      <p className="note" data-narrative="">
        Výkon v kW se s výstupní teplotou mění jen málo a na teplotě okolí nezávisí vůbec. Ideální ekvivalent N_eq (k = 1)
        roste prudce, když se výstupní teplota blíží teplotě vzduchu. Proto se odpařovač nevybírá podle kW.
      </p>
      <h3>
        Vs. výstupní teplota (vzduch <Qty v={T_des} unit="°C" src="VYPOCET" d={1} />)
      </h3>
      <div className="chart-grid">
        <LineChart
          title="Výkon Q vs. výstupní teplota"
          src="VYPOCET"
          xLabel="T_out"
          xUnit="°C"
          yLabel="Q"
          yUnit="kW"
          yDecimals={2}
          xDecimals={1}
          series={[{ name: 'Q', slot: 1, points: toSeries(data.tout, 'Q_kW') }]}
          marker={{ x: d.T_out_C, y: d.Q_kW, label: 'návrh' }}
        />
        <LineChart
          title="N_eq vs. výstupní teplota"
          src="VYPOCET"
          xLabel="T_out"
          xUnit="°C"
          yLabel="N_eq"
          yUnit="Nm³/h kat."
          yDecimals={1}
          xDecimals={1}
          series={[{ name: 'N_eq', slot: 1, points: toSeries(data.tout, 'N_eq_Nm3_h') }]}
          marker={neqNow !== null ? { x: d.T_out_C, y: neqNow, label: 'návrh' } : null}
          note={`Nad T_out ≥ ${fmt(T_des, 1)} °C (teplota vzduchu pro posouzení) atmosférický odpařovač výstupní teploty nedosáhne – křivka končí.`}
        />
      </div>
      <SensTable caption="Q a N_eq vs. výstupní teplota" xLabel="T_out" points={data.tout} />

      <h3>
        Vs. teplota okolí <span data-narrative="">(−20 až +20 °C)</span>, T_out{' '}
        <Qty v={d.T_out_C} unit="°C" src="VSTUP" d={1} />
      </h3>
      <div className="chart-grid">
        <LineChart
          title="Výkon Q vs. teplota okolí"
          src="VYPOCET"
          xLabel="T_okolí"
          xUnit="°C"
          yLabel="Q"
          yUnit="kW"
          yDecimals={2}
          series={[{ name: 'Q', slot: 1, points: toSeries(data.tamb, 'Q_kW') }]}
          note="Q na teplotě okolí nezávisí: potřeba tepla je dána látkou, tlakem a teplotami kapaliny a plynu."
        />
        <LineChart
          title="N_eq vs. teplota okolí"
          src="VYPOCET"
          xLabel="T_okolí"
          xUnit="°C"
          yLabel="N_eq"
          yUnit="Nm³/h kat."
          yDecimals={1}
          series={[{ name: 'N_eq', slot: 1, points: toSeries(data.tamb, 'N_eq_Nm3_h') }]}
          marker={neqNow !== null && T_des >= -20 && T_des <= 20 ? { x: T_des, y: neqNow, label: 'posouzení' } : null}
          note="Model konstantního U – optimistický; v mrazu skutečná potřeba roste ještě víc (námraza, chybějící latentní teplo)."
        />
      </div>
      <SensTable caption="Q a N_eq vs. teplota okolí" xLabel="T_okolí" points={data.tamb} />

      <h3>Absolutní vlhkost vzduchu vs. teplota (vysvětlující model)</h3>
      <div className="chart-grid one">
        <LineChart
          title="Absolutní vlhkost x vs. teplota"
          src="VYPOCET"
          xLabel="T"
          xUnit="°C"
          yLabel="x"
          yUnit="g/kg"
          yDecimals={2}
          series={[
            { name: `RH ${fmt(RH, 0)} %`, slot: 1, points: data.hum.map((p) => ({ x: p.T_C, y: p.x_RH_g_kg })) },
            { name: 'nasycení 100 %', slot: 2, points: data.hum.map((p) => ({ x: p.T_C, y: p.x_sat_g_kg })) },
          ]}
          note="Magnusův vzorec, pod 0 °C nad ledem. Neslouží k dimenzování."
        />
      </div>
      <p className="note">
        <span data-narrative="">Při 20 °C a 75 % RH nese vzduch </span>
        <Qty v={xSummer} unit="g/kg" src="VYPOCET" />
        <span data-narrative="">, při −15 °C a 85 % RH jen </span>
        <Qty v={xWinter} unit="g/kg" src="VYPOCET" />
        <span data-narrative="">. Každý vymrzlý gram vody odevzdá asi </span>
        <Qty v={LATENT_KJ_PER_G} unit="kJ/g" src="VYPOCET" d={1} />
        <span data-narrative="">
          {' '}
          latentního tepla – v mrazu tento příspěvek chybí, a katalogová kapacita (měřená při vyšší teplotě a vlhkosti) proto
          nadhodnocuje skutečný výkon.
        </span>
      </p>
      <details className="table-view">
        <summary>Tabulka: absolutní vlhkost</summary>
        <div className="table-scroll" data-chart="">
          <table>
            <caption>
              Absolutní vlhkost x [g/kg] <SourceTag src="VYPOCET" />
            </caption>
            <thead>
              <tr>
                <th scope="col">T [°C]</th>
                <th scope="col">x při RH {fmt(RH, 0)} % [g/kg]</th>
                <th scope="col">x při 100 % [g/kg]</th>
              </tr>
            </thead>
            <tbody>
              {data.hum.map((p) => (
                <tr key={p.T_C}>
                  <td>{fmt(p.T_C, 0)}</td>
                  <td>{fmt(p.x_RH_g_kg, 2)}</td>
                  <td>{fmt(p.x_sat_g_kg, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
